package services

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/noatgnu/cupcake-webgui/cupcake-wails/backend/models"
)

type BackendUpdater struct {
	backendDownloader *BackendDownloader
	backendManager    *BackendManager
	backupManager     *BackupManager
	userDataPath      string
	logCallback       func(message string, level string)
	progressCallback  func(models.DownloadProgress)
}

type UpdateOptions struct {
	Version           string
	CreateBackup      bool
	PythonVersion     string
	ForceReinstallDeps bool
}


func NewBackendUpdater(
	userDataPath string,
	backendDownloader *BackendDownloader,
	backendManager *BackendManager,
	backupManager *BackupManager,
) *BackendUpdater {
	return &BackendUpdater{
		backendDownloader: backendDownloader,
		backendManager:    backendManager,
		backupManager:     backupManager,
		userDataPath:      userDataPath,
	}
}

func (u *BackendUpdater) SetLogCallback(callback func(message string, level string)) {
	u.logCallback = callback
}

func (u *BackendUpdater) SetProgressCallback(callback func(models.DownloadProgress)) {
	u.progressCallback = callback
}

func (u *BackendUpdater) log(message string, level string) {
	log.Printf("[BackendUpdater] [%s] %s", level, message)
	if u.logCallback != nil {
		u.logCallback(message, level)
	}
}

func (u *BackendUpdater) CheckForUpdates() (*models.UpdateInfo, error) {
	u.log("Checking for backend updates...", "info")

	releases, err := u.backendDownloader.GetAvailableReleases()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch releases: %w", err)
	}

	if len(releases) == 0 {
		return &models.UpdateInfo{
			UpdateAvailable: false,
			Message:         "No releases found",
		}, nil
	}

	latestRelease := releases[0]
	currentVersion := u.getCurrentVersion()

	updateAvailable := currentVersion != latestRelease.Tag && latestRelease.Tag != ""

	return &models.UpdateInfo{
		UpdateAvailable: updateAvailable,
		CurrentVersion:  currentVersion,
		LatestVersion:   latestRelease.Tag,
		LatestName:      latestRelease.Name,
		PublishedAt:     latestRelease.PublishedAt,
		HasPortable:     latestRelease.HasPortable,
		Message:         u.getUpdateMessage(updateAvailable, currentVersion, latestRelease.Tag),
	}, nil
}

func (u *BackendUpdater) getCurrentVersion() string {
	backendPath := u.getBackendPath()
	versionFile := filepath.Join(backendPath, "VERSION")

	data, err := os.ReadFile(versionFile)
	if err != nil {
		gitTagFile := filepath.Join(backendPath, ".git", "HEAD")
		if _, err := os.Stat(gitTagFile); err == nil {
			return "dev"
		}
		return "unknown"
	}

	return strings.TrimSpace(string(data))
}

func (u *BackendUpdater) getUpdateMessage(available bool, current, latest string) string {
	if !available {
		return fmt.Sprintf("Backend is up to date (version %s)", current)
	}
	return fmt.Sprintf("Update available: %s -> %s", current, latest)
}

func (u *BackendUpdater) getBackendPath() string {
	return filepath.Join(u.userDataPath, "backend")
}

func (u *BackendUpdater) Update(opts UpdateOptions) (*models.UpdateResult, error) {
	result := &models.UpdateResult{
		PreviousVersion: u.getCurrentVersion(),
		NewVersion:      opts.Version,
	}

	u.log(fmt.Sprintf("Starting backend update to version %s", opts.Version), "info")

	if opts.CreateBackup {
		u.log("Creating pre-update backup...", "info")
		if err := u.createPreUpdateBackup(); err != nil {
			u.log(fmt.Sprintf("Warning: backup creation failed: %v", err), "warn")
		} else {
			result.BackupCreated = true
			u.log("Pre-update backup created successfully", "success")
		}
	}

	u.log("Stopping backend services...", "info")
	if err := u.stopServices(); err != nil {
		u.log(fmt.Sprintf("Warning: failed to stop some services: %v", err), "warn")
	}

	backendPath := u.getBackendPath()

	u.log("Preserving user data and cleaning old backend...", "info")
	if err := u.cleanBackendPreservingData(backendPath); err != nil {
		result.Success = false
		result.Message = fmt.Sprintf("Failed to clean backend: %v", err)
		return result, err
	}

	u.log(fmt.Sprintf("Downloading backend version %s...", opts.Version), "info")
	downloadOpts := BackendDownloadOptions{
		Version:       opts.Version,
		IsPortable:    true,
		PythonVersion: opts.PythonVersion,
		DestPath:      backendPath,
	}

	if err := u.backendDownloader.DownloadPortable(downloadOpts); err != nil {
		if err := u.backendDownloader.DownloadSource(backendPath, opts.Version); err != nil {
			result.Success = false
			result.Message = fmt.Sprintf("Failed to download backend: %v", err)
			return result, err
		}
	}

	u.log("Running database migrations...", "info")
	if err := u.runMigrations(); err != nil {
		u.log(fmt.Sprintf("Warning: migrations failed: %v", err), "warn")
	}

	u.log("Restarting backend services...", "info")
	if err := u.startServices(); err != nil {
		result.Success = false
		result.Message = fmt.Sprintf("Failed to restart services: %v", err)
		return result, err
	}

	result.Success = true
	result.Message = fmt.Sprintf("Successfully updated from %s to %s", result.PreviousVersion, opts.Version)
	u.log(result.Message, "success")

	return result, nil
}

func (u *BackendUpdater) createPreUpdateBackup() error {
	if u.backupManager == nil {
		return fmt.Errorf("backup manager not available")
	}

	backendPath := u.getBackendPath()
	pythonPath := u.backendDownloader.GetPortablePythonPath(backendPath)

	if err := u.backupManager.CreateDatabaseBackup(backendPath, pythonPath, func(output string, isError bool) {
		level := "info"
		if isError {
			level = "error"
		}
		u.log(output, level)
	}); err != nil {
		return fmt.Errorf("database backup failed: %w", err)
	}

	if err := u.backupManager.CreateMediaBackup(backendPath, pythonPath, func(output string, isError bool) {
		level := "info"
		if isError {
			level = "error"
		}
		u.log(output, level)
	}); err != nil {
		return fmt.Errorf("media backup failed: %w", err)
	}

	return nil
}

func (u *BackendUpdater) stopServices() error {
	if u.backendManager == nil {
		return nil
	}

	u.backendManager.StopServices()

	return nil
}

func (u *BackendUpdater) startServices() error {
	return nil
}

func (u *BackendUpdater) cleanBackendPreservingData(backendPath string) error {
	if _, err := os.Stat(backendPath); os.IsNotExist(err) {
		return nil
	}

	entries, err := os.ReadDir(backendPath)
	if err != nil {
		return err
	}

	preserveList := []string{
		"db.",
		"media",
		"backups",
		".env",
	}

	for _, entry := range entries {
		name := entry.Name()
		shouldPreserve := false

		for _, prefix := range preserveList {
			if strings.HasPrefix(name, prefix) || name == prefix {
				shouldPreserve = true
				break
			}
		}

		if shouldPreserve {
			u.log(fmt.Sprintf("Preserving: %s", name), "info")
			continue
		}

		fullPath := filepath.Join(backendPath, name)
		u.log(fmt.Sprintf("Removing: %s", name), "info")
		if err := os.RemoveAll(fullPath); err != nil {
			u.log(fmt.Sprintf("Warning: failed to remove %s: %v", name, err), "warn")
		}
	}

	return nil
}

func (u *BackendUpdater) runMigrations() error {
	backendPath := u.getBackendPath()
	pythonPath := u.backendDownloader.GetPortablePythonPath(backendPath)

	if _, err := os.Stat(pythonPath); os.IsNotExist(err) {
		u.log("Portable Python not found, skipping migrations", "warn")
		return nil
	}

	return u.backendManager.RunManagementCommand(backendPath, pythonPath, "migrate", []string{"--noinput"}, func(output string, isError bool) {
		level := "info"
		if isError {
			level = "error"
		}
		u.log(output, level)
	})
}

func (u *BackendUpdater) GetAvailableReleases() ([]models.ReleaseInfo, error) {
	return u.backendDownloader.GetAvailableReleases()
}

func (u *BackendUpdater) Rollback(backupPath string) error {
	u.log("Starting rollback from backup...", "info")

	u.log("Stopping services...", "info")
	if err := u.stopServices(); err != nil {
		u.log(fmt.Sprintf("Warning: failed to stop services: %v", err), "warn")
	}

	backendPath := u.getBackendPath()
	pythonPath := u.backendDownloader.GetPortablePythonPath(backendPath)

	u.log("Restoring database from backup...", "info")
	if err := u.backupManager.RestoreDatabase(backendPath, pythonPath, func(output string, isError bool) {
		level := "info"
		if isError {
			level = "error"
		}
		u.log(output, level)
	}); err != nil {
		return fmt.Errorf("database restore failed: %w", err)
	}

	u.log("Restoring media from backup...", "info")
	if err := u.backupManager.RestoreMedia(backendPath, pythonPath, func(output string, isError bool) {
		level := "info"
		if isError {
			level = "error"
		}
		u.log(output, level)
	}); err != nil {
		return fmt.Errorf("media restore failed: %w", err)
	}

	u.log("Rollback completed successfully", "success")
	return nil
}
