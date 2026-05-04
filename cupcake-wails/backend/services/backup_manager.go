package services

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type BackupManager struct {
	userDataPath   string
	backupDir      string
	defaultDir     string
	backendManager *BackendManager
	db             *DatabaseService
	logCallback    func(message string, msgType string)
}

type BackupInfo struct {
	Name      string `json:"name"`
	Path      string `json:"path"`
	Size      int64  `json:"size"`
	CreatedAt string `json:"createdAt"`
	Type      string `json:"type"`
}

type BackupOptions struct {
	IncludeDatabase bool `json:"includeDatabase"`
	IncludeMedia    bool `json:"includeMedia"`
}

type BackupResult struct {
	Success  bool   `json:"success"`
	Message  string `json:"message"`
	FilePath string `json:"filePath"`
	Size     int64  `json:"size"`
}

func NewBackupManager(userDataPath string, backendManager *BackendManager, db *DatabaseService) *BackupManager {
	defaultDir := filepath.Join(userDataPath, "backend", "backups")
	os.MkdirAll(defaultDir, 0755)

	backupDir := defaultDir
	if db != nil {
		if customDir, err := db.GetConfig("backup_directory"); err == nil && customDir != "" {
			if _, err := os.Stat(customDir); err == nil {
				backupDir = customDir
			}
		}
	}

	return &BackupManager{
		userDataPath:   userDataPath,
		backupDir:      backupDir,
		defaultDir:     defaultDir,
		backendManager: backendManager,
		db:             db,
	}
}

func (b *BackupManager) SetLogCallback(callback func(message string, msgType string)) {
	b.logCallback = callback
}

func (b *BackupManager) log(message, msgType string) {
	log.Printf("[BackupManager] [%s] %s", msgType, message)
	if b.logCallback != nil {
		b.logCallback(message, msgType)
	}
}

func (b *BackupManager) GetBackupDir() string {
	return b.backupDir
}

func (b *BackupManager) GetDefaultBackupDir() string {
	return b.defaultDir
}

func (b *BackupManager) SetBackupDir(dir string) error {
	if dir == "" {
		dir = b.defaultDir
	}

	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create backup directory: %w", err)
	}

	b.backupDir = dir

	if b.db != nil {
		if err := b.db.SetConfig("backup_directory", dir); err != nil {
			b.log(fmt.Sprintf("Failed to save backup directory setting: %v", err), "warning")
		}
	}

	b.log(fmt.Sprintf("Backup directory set to: %s", dir), "info")
	return nil
}

func (b *BackupManager) ResetBackupDir() error {
	return b.SetBackupDir(b.defaultDir)
}

func (b *BackupManager) CreateDatabaseBackup(backendDir, pythonPath string, outputCallback func(string, bool)) error {
	b.log("Creating database backup using Django dbbackup...", "info")

	if err := os.MkdirAll(b.backupDir, 0755); err != nil {
		b.log(fmt.Sprintf("Failed to create backup directory: %v", err), "error")
		return fmt.Errorf("failed to create backup directory: %w", err)
	}

	args := []string{"--noinput", "--clean"}
	err := b.backendManager.RunManagementCommand(backendDir, pythonPath, "dbbackup", args, outputCallback)
	if err != nil {
		b.log(fmt.Sprintf("Database backup failed: %v", err), "error")
		return fmt.Errorf("database backup failed: %w", err)
	}

	b.log("Database backup completed successfully", "success")
	return nil
}

func (b *BackupManager) CreateMediaBackup(backendDir, pythonPath string, outputCallback func(string, bool)) error {
	b.log("Creating media backup using Django mediabackup...", "info")

	if err := os.MkdirAll(b.backupDir, 0755); err != nil {
		b.log(fmt.Sprintf("Failed to create backup directory: %v", err), "error")
		return fmt.Errorf("failed to create backup directory: %w", err)
	}

	args := []string{"--noinput", "--clean"}
	err := b.backendManager.RunManagementCommand(backendDir, pythonPath, "mediabackup", args, outputCallback)
	if err != nil {
		b.log(fmt.Sprintf("Media backup failed: %v", err), "error")
		return fmt.Errorf("media backup failed: %w", err)
	}

	b.log("Media backup completed successfully", "success")
	return nil
}

func (b *BackupManager) RestoreDatabase(backendDir, pythonPath string, outputCallback func(string, bool)) error {
	b.log("Restoring database from latest backup...", "info")

	latestBackup, err := b.findLatestBackup("database")
	if err != nil {
		b.log(fmt.Sprintf("No database backup found: %v", err), "error")
		return fmt.Errorf("no database backup found: %w", err)
	}

	b.log(fmt.Sprintf("Restoring from: %s", latestBackup), "info")
	var args []string
	if strings.HasSuffix(latestBackup, ".gz") {
		args = []string{"--noinput", "--uncompress", "--input-filename", latestBackup}
	} else {
		args = []string{"--noinput", "--input-filename", latestBackup}
	}
	err = b.backendManager.RunManagementCommand(backendDir, pythonPath, "dbrestore", args, outputCallback)
	if err != nil {
		b.log(fmt.Sprintf("Database restore failed: %v", err), "error")
		return fmt.Errorf("database restore failed: %w", err)
	}

	b.log("Database restored successfully", "success")
	return nil
}

func (b *BackupManager) RestoreMedia(backendDir, pythonPath string, outputCallback func(string, bool)) error {
	b.log("Restoring media from latest backup...", "info")

	latestBackup, err := b.findLatestBackup("media")
	if err != nil {
		b.log(fmt.Sprintf("No media backup found: %v", err), "error")
		return fmt.Errorf("no media backup found: %w", err)
	}

	b.log(fmt.Sprintf("Restoring from: %s", latestBackup), "info")
	var args []string
	if strings.HasSuffix(latestBackup, ".gz") {
		args = []string{"--noinput", "--uncompress", "--input-filename", latestBackup}
	} else {
		args = []string{"--noinput", "--input-filename", latestBackup}
	}
	err = b.backendManager.RunManagementCommand(backendDir, pythonPath, "mediarestore", args, outputCallback)
	if err != nil {
		b.log(fmt.Sprintf("Media restore failed: %v", err), "error")
		return fmt.Errorf("media restore failed: %w", err)
	}

	b.log("Media restored successfully", "success")
	return nil
}

func (b *BackupManager) findLatestBackup(backupType string) (string, error) {
	backups, err := b.ListBackups()
	if err != nil {
		return "", err
	}

	for _, backup := range backups {
		if backup.Type == backupType {
			return backup.Path, nil
		}
	}

	return "", fmt.Errorf("no %s backup found", backupType)
}

func (b *BackupManager) ListBackups() ([]BackupInfo, error) {
	var backups []BackupInfo

	entries, err := os.ReadDir(b.backupDir)
	if err != nil {
		if os.IsNotExist(err) {
			return backups, nil
		}
		return nil, fmt.Errorf("failed to read backup directory: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		backupType := "unknown"
		name := entry.Name()

		if strings.HasPrefix(name, "default-") || strings.HasSuffix(name, ".psql") || strings.HasSuffix(name, ".psql.gz") || strings.HasSuffix(name, ".sqlite3") || strings.HasSuffix(name, ".sqlite3.gz") || strings.HasSuffix(name, ".dump") || strings.HasSuffix(name, ".dump.gz") {
			backupType = "database"
		} else if strings.HasPrefix(name, "media-") || strings.HasSuffix(name, ".tar") || strings.HasSuffix(name, ".tar.gz") {
			backupType = "media"
		}

		backups = append(backups, BackupInfo{
			Name:      name,
			Path:      filepath.Join(b.backupDir, name),
			Size:      info.Size(),
			CreatedAt: info.ModTime().Format(time.RFC3339),
			Type:      backupType,
		})
	}

	sort.Slice(backups, func(i, j int) bool {
		return backups[i].CreatedAt > backups[j].CreatedAt
	})

	return backups, nil
}

func (b *BackupManager) ImportDatabaseFromFile(srcPath, backendDir string) error {
	b.log(fmt.Sprintf("Importing database from: %s", srcPath), "info")

	dbDir := filepath.Join(backendDir, "cupcake-vanilla")
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		b.log(fmt.Sprintf("Failed to create database directory: %v", err), "error")
		return fmt.Errorf("failed to create database directory: %w", err)
	}

	dbPath := filepath.Join(dbDir, "cupcake_vanilla.db")

	src, err := os.Open(srcPath)
	if err != nil {
		b.log(fmt.Sprintf("Failed to open source file: %v", err), "error")
		return fmt.Errorf("failed to open source file: %w", err)
	}
	defer src.Close()

	dst, err := os.Create(dbPath)
	if err != nil {
		b.log(fmt.Sprintf("Failed to create destination database file: %v", err), "error")
		return fmt.Errorf("failed to create database file: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		b.log(fmt.Sprintf("Failed to copy database file: %v", err), "error")
		return fmt.Errorf("failed to copy database file: %w", err)
	}

	b.log("Database file imported successfully", "success")
	return nil
}

func (b *BackupManager) DeleteBackup(backupPath string) error {
	if !strings.HasPrefix(filepath.Clean(backupPath), filepath.Clean(b.backupDir)) {
		return fmt.Errorf("invalid backup path")
	}

	if _, err := os.Stat(backupPath); os.IsNotExist(err) {
		return fmt.Errorf("backup file not found")
	}

	if err := os.Remove(backupPath); err != nil {
		return fmt.Errorf("failed to delete backup: %w", err)
	}

	b.log(fmt.Sprintf("Deleted backup: %s", filepath.Base(backupPath)), "success")
	return nil
}
