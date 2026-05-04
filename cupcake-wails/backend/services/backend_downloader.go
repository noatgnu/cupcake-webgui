package services

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/noatgnu/cupcake/cupcake-wails/backend/models"
)

const (
	GithubReleasesURL = "https://api.github.com/repos/noatgnu/cupcake/releases"
	GithubRepoURL     = "https://api.github.com/repos/noatgnu/cupcake"
	GithubOwner       = "noatgnu"
	GithubRepo        = "cupcake"
	GithubCloneURL    = "https://github.com/noatgnu/cupcake.git"
)

type BackendDownloader struct {
	progressHandler func(models.DownloadProgress)
	downloadManager *DownloadManager
}

type BackendDownloadOptions struct {
	Version       string
	IsPortable    bool
	PythonVersion string
	DestPath      string
}

func NewBackendDownloader(progressHandler func(models.DownloadProgress)) *BackendDownloader {
	dm := NewDownloadManager()
	dm.SetProgressHandler(progressHandler)

	return &BackendDownloader{
		progressHandler: progressHandler,
		downloadManager: dm,
	}
}

func (b *BackendDownloader) GetAvailableReleases() ([]models.ReleaseInfo, error) {
	resp, err := http.Get(GithubReleasesURL)
	if err != nil {
		return b.getDefaultBranch(), nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return b.getDefaultBranch(), nil
	}

	var releases []struct {
		TagName     string `json:"tag_name"`
		Name        string `json:"name"`
		PublishedAt string `json:"published_at"`
		Assets      []struct {
			Name string `json:"name"`
		} `json:"assets"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&releases); err != nil {
		return b.getDefaultBranch(), nil
	}

	if len(releases) == 0 {
		return b.getDefaultBranch(), nil
	}

	var result []models.ReleaseInfo
	for _, r := range releases {
		hasPortable := false
		for _, asset := range r.Assets {
			if strings.HasSuffix(asset.Name, ".tar.gz") || strings.HasSuffix(asset.Name, ".zip") {
				hasPortable = true
				break
			}
		}
		result = append(result, models.ReleaseInfo{
			Tag:         r.TagName,
			Name:        r.Name,
			PublishedAt: r.PublishedAt,
			HasPortable: hasPortable,
		})
	}

	return result, nil
}

func (b *BackendDownloader) getDefaultBranch() []models.ReleaseInfo {
	branch := b.fetchDefaultBranch()
	return []models.ReleaseInfo{
		{
			Tag:         branch,
			Name:        fmt.Sprintf("Latest (%s branch)", branch),
			PublishedAt: "",
		},
	}
}

func (b *BackendDownloader) fetchDefaultBranch() string {
	resp, err := http.Get(GithubRepoURL)
	if err != nil {
		return "master"
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "master"
	}

	var repo struct {
		DefaultBranch string `json:"default_branch"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&repo); err != nil {
		return "master"
	}

	if repo.DefaultBranch == "" {
		return "master"
	}

	return repo.DefaultBranch
}

func (b *BackendDownloader) DownloadPortable(opts BackendDownloadOptions) error {
	if !opts.IsPortable {
		return b.DownloadSource(opts.DestPath, opts.Version)
	}

	osName, arch := b.getPlatformInfo()

	pythonVer := opts.PythonVersion
	if pythonVer == "" {
		pythonVer = "3.12"
	}

	assetFormats := []string{
		fmt.Sprintf("cupcake-%s-py%s-%s-%s.tar.gz", opts.Version, pythonVer, osName, arch),
		fmt.Sprintf("cupcake-%s-%s-%s.tar.gz", opts.Version, osName, arch),
		fmt.Sprintf("cupcake-%s-%s-%s-python%s.tar.gz", opts.Version, osName, arch, pythonVer),
	}

	var downloadURL string
	var assetName string
	for _, name := range assetFormats {
		url := fmt.Sprintf("https://github.com/%s/%s/releases/download/%s/%s",
			GithubOwner, GithubRepo, opts.Version, name)

		resp, err := http.Head(url)
		if err == nil && resp.StatusCode == http.StatusOK {
			downloadURL = url
			assetName = name
			resp.Body.Close()
			break
		}
		if resp != nil {
			resp.Body.Close()
		}
	}

	if downloadURL == "" {
		return fmt.Errorf("no portable release found for version %s on %s/%s", opts.Version, osName, arch)
	}

	log.Printf("[BackendDownloader] Downloading from: %s (asset: %s)", downloadURL, assetName)

	tempFile := filepath.Join(os.TempDir(), fmt.Sprintf("cupcake_backend_%d.tar.gz", os.Getpid()))
	defer os.Remove(tempFile)

	if err := b.downloadManager.DownloadFile(downloadURL, tempFile); err != nil {
		return fmt.Errorf("download failed: %w", err)
	}

	if err := b.extractTarGz(tempFile, opts.DestPath); err != nil {
		return fmt.Errorf("extraction failed: %w", err)
	}

	return nil
}

func (b *BackendDownloader) getPlatformInfo() (osName string, arch string) {
	switch runtime.GOOS {
	case "darwin":
		osName = "macos"
	case "windows":
		osName = "windows"
	default:
		osName = "linux"
	}

	switch runtime.GOARCH {
	case "arm64":
		arch = "aarch64"
	default:
		arch = "x86_64"
	}

	return osName, arch
}

func (b *BackendDownloader) DownloadSource(destPath string, branch string) error {
	if branch == "" {
		branch = b.fetchDefaultBranch()
	}
	return b.cloneRepo(destPath, branch)
}

func (b *BackendDownloader) cloneRepo(destPath string, branch string) error {
	log.Printf("[BackendDownloader] Cloning repository (branch: %s) to %s", branch, destPath)

	if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
		return err
	}

	if _, err := os.Stat(destPath); err == nil {
		gitDir := filepath.Join(destPath, ".git")
		if _, err := os.Stat(gitDir); err == nil {
			log.Printf("[BackendDownloader] Repository already exists, pulling latest changes")
			return b.pullRepo(destPath, branch)
		}
		if err := b.CleanBackend(destPath); err != nil {
			return err
		}
	}

	_, err := git.PlainClone(destPath, false, &git.CloneOptions{
		URL:           GithubCloneURL,
		ReferenceName: plumbing.NewBranchReferenceName(branch),
		Depth:         1,
		Progress:      nil,
	})
	if err != nil {
		return fmt.Errorf("git clone failed: %w", err)
	}

	log.Printf("[BackendDownloader] Clone complete")
	return nil
}

func (b *BackendDownloader) pullRepo(destPath string, branch string) error {
	repo, err := git.PlainOpen(destPath)
	if err != nil {
		return fmt.Errorf("failed to open repository: %w", err)
	}

	worktree, err := repo.Worktree()
	if err != nil {
		return fmt.Errorf("failed to get worktree: %w", err)
	}

	err = worktree.Checkout(&git.CheckoutOptions{
		Branch: plumbing.NewBranchReferenceName(branch),
	})
	if err != nil {
		log.Printf("[BackendDownloader] Warning: checkout failed: %v", err)
	}

	err = worktree.Pull(&git.PullOptions{
		RemoteName: "origin",
	})
	if err != nil && err != git.NoErrAlreadyUpToDate {
		return fmt.Errorf("git pull failed: %w", err)
	}

	log.Printf("[BackendDownloader] Pull complete")
	return nil
}

func (b *BackendDownloader) downloadZip(destPath string, branch string) error {
	zipURL := fmt.Sprintf("https://github.com/%s/%s/archive/refs/heads/%s.zip", GithubOwner, GithubRepo, branch)
	log.Printf("[BackendDownloader] Downloading source zip from %s to %s", zipURL, destPath)

	tempFile := filepath.Join(os.TempDir(), fmt.Sprintf("cupcake_%d.zip", os.Getpid()))
	defer os.Remove(tempFile)

	if err := b.downloadManager.DownloadFile(zipURL, tempFile); err != nil {
		return fmt.Errorf("download failed: %w", err)
	}

	if err := b.extractZip(tempFile, destPath); err != nil {
		return fmt.Errorf("extraction failed: %w", err)
	}

	return nil
}

func (b *BackendDownloader) extractZip(zipPath, destPath string) error {
	log.Printf("[BackendDownloader] Extracting %s to %s", zipPath, destPath)

	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer r.Close()

	if err := os.MkdirAll(destPath, 0755); err != nil {
		return err
	}

	var rootDir string
	for _, f := range r.File {
		parts := strings.SplitN(f.Name, "/", 2)
		if len(parts) > 0 && rootDir == "" {
			rootDir = parts[0]
		}

		var targetPath string
		if len(parts) > 1 {
			targetPath = filepath.Join(destPath, parts[1])
		} else {
			continue
		}

		if f.FileInfo().IsDir() {
			os.MkdirAll(targetPath, 0755)
			continue
		}

		if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
			return err
		}

		outFile, err := os.Create(targetPath)
		if err != nil {
			return err
		}

		rc, err := f.Open()
		if err != nil {
			outFile.Close()
			return err
		}

		_, err = io.Copy(outFile, rc)
		rc.Close()
		outFile.Close()
		if err != nil {
			return err
		}

		if f.Mode()&0111 != 0 {
			os.Chmod(targetPath, 0755)
		}
	}

	log.Printf("[BackendDownloader] Extraction complete")
	return nil
}

func (b *BackendDownloader) extractTarGz(archivePath, destPath string) error {
	log.Printf("[BackendDownloader] Extracting %s to %s", archivePath, destPath)

	file, err := os.Open(archivePath)
	if err != nil {
		return err
	}
	defer file.Close()

	gzr, err := gzip.NewReader(file)
	if err != nil {
		return err
	}
	defer gzr.Close()

	tr := tar.NewReader(gzr)

	if err := os.MkdirAll(destPath, 0755); err != nil {
		return err
	}

	var rootDir string

	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		name := header.Name
		if rootDir == "" {
			parts := strings.SplitN(name, "/", 2)
			if len(parts) > 1 {
				rootDir = parts[0] + "/"
			}
		}

		if rootDir != "" && strings.HasPrefix(name, rootDir) {
			name = strings.TrimPrefix(name, rootDir)
			if name == "" {
				continue
			}
		}

		targetPath := filepath.Join(destPath, name)

		parentDir := filepath.Dir(targetPath)
		if err := os.MkdirAll(parentDir, 0755); err != nil {
			return err
		}

		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(targetPath, 0755); err != nil {
				return err
			}
		case tar.TypeReg:
			outFile, err := os.Create(targetPath)
			if err != nil {
				return err
			}
			if _, err := io.Copy(outFile, tr); err != nil {
				outFile.Close()
				return err
			}
			outFile.Close()

			if header.Mode&0111 != 0 {
				os.Chmod(targetPath, 0755)
			}
		case tar.TypeSymlink:
			os.Remove(targetPath)
			if err := os.Symlink(header.Linkname, targetPath); err != nil {
				log.Printf("[BackendDownloader] Warning: failed to create symlink %s: %v", targetPath, err)
			}
		}
	}

	log.Printf("[BackendDownloader] Extraction complete (stripped root: %s)", rootDir)
	return nil
}

func (b *BackendDownloader) BackendExists(backendPath string) bool {
	managePyPath := filepath.Join(backendPath, "manage.py")
	_, err := os.Stat(managePyPath)
	return err == nil
}

func (b *BackendDownloader) IsPortableBackend(backendPath string) bool {
	var pythonPath string
	if runtime.GOOS == "windows" {
		pythonPath = filepath.Join(backendPath, "python", "python.exe")
	} else {
		pythonPath = filepath.Join(backendPath, "python", "bin", "python3")
	}
	_, err := os.Stat(pythonPath)
	return err == nil
}

func (b *BackendDownloader) GetPortablePythonPath(backendPath string) string {
	if runtime.GOOS == "windows" {
		return filepath.Join(backendPath, "python", "python.exe")
	}
	return filepath.Join(backendPath, "python", "bin", "python3")
}

func (b *BackendDownloader) CleanBackend(backendPath string) error {
	if _, err := os.Stat(backendPath); os.IsNotExist(err) {
		return nil
	}

	entries, err := os.ReadDir(backendPath)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		name := entry.Name()
		if strings.HasPrefix(name, "db.") || name == "media" || name == "backups" || name == ".env" {
			continue
		}
		os.RemoveAll(filepath.Join(backendPath, name))
	}

	return nil
}
