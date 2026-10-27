package services

import (
	"archive/tar"
	"archive/zip"
	"bufio"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/noatgnu/cupcake-webgui/cupcake-wails/backend/models"
)

const (
	UvReleasesURL = "https://api.github.com/repos/astral-sh/uv/releases/latest"

	// ManagedPythonVersion is the interpreter version uv installs for native backends,
	// matching the Python bundled with portable releases.
	ManagedPythonVersion = "3.12"

	// UvManagedPythonPrefix marks a candidate path that refers to a uv-managed interpreter
	// rather than an executable on disk, e.g. "uv:3.12".
	UvManagedPythonPrefix = "uv:"
)

// UvManager downloads and drives the uv binary used to provision Python interpreters,
// virtual environments and dependencies for native backend installs. Everything uv
// writes (binary, interpreters, cache) is kept under the app's user data directory.
type UvManager struct {
	userDataPath    string
	releasesURL     string
	logCallback     func(message string, msgType string)
	progressHandler func(models.DownloadProgress)
}

type githubReleaseAsset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

type githubRelease struct {
	TagName string               `json:"tag_name"`
	Assets  []githubReleaseAsset `json:"assets"`
}

func NewUvManager(userDataPath string) *UvManager {
	return &UvManager{
		userDataPath: userDataPath,
		releasesURL:  UvReleasesURL,
	}
}

func (u *UvManager) SetLogCallback(callback func(message string, msgType string)) {
	u.logCallback = callback
}

func (u *UvManager) SetProgressHandler(handler func(models.DownloadProgress)) {
	u.progressHandler = handler
}

func (u *UvManager) log(message string, msgType string) {
	log.Printf("[UvManager] [%s] %s", msgType, message)
	if u.logCallback != nil {
		u.logCallback(message, msgType)
	}
}

// UvReleaseAsset maps a Go OS/arch pair to the matching astral-sh/uv release asset name.
func UvReleaseAsset(goos, goarch string) (string, error) {
	switch {
	case goos == "linux" && goarch == "amd64":
		return "uv-x86_64-unknown-linux-gnu.tar.gz", nil
	case goos == "linux" && goarch == "arm64":
		return "uv-aarch64-unknown-linux-gnu.tar.gz", nil
	case goos == "darwin" && goarch == "amd64":
		return "uv-x86_64-apple-darwin.tar.gz", nil
	case goos == "darwin" && goarch == "arm64":
		return "uv-aarch64-apple-darwin.tar.gz", nil
	case goos == "windows" && goarch == "amd64":
		return "uv-x86_64-pc-windows-msvc.zip", nil
	case goos == "windows" && goarch == "arm64":
		return "uv-aarch64-pc-windows-msvc.zip", nil
	default:
		return "", fmt.Errorf("no uv release asset known for %s/%s", goos, goarch)
	}
}

// IsUvManagedPythonPath reports whether path names a uv-managed interpreter and returns its version.
func IsUvManagedPythonPath(path string) (string, bool) {
	if !strings.HasPrefix(path, UvManagedPythonPrefix) {
		return "", false
	}
	version := strings.TrimPrefix(path, UvManagedPythonPrefix)
	if version == "" {
		version = ManagedPythonVersion
	}
	return version, true
}

func uvBinaryName() string {
	if runtime.GOOS == "windows" {
		return "uv.exe"
	}
	return "uv"
}

func (u *UvManager) uvRoot() string {
	return filepath.Join(u.userDataPath, "uv")
}

// ManagedUvPath is where the app-managed uv binary lives once downloaded.
func (u *UvManager) ManagedUvPath() string {
	return filepath.Join(u.uvRoot(), "bin", uvBinaryName())
}

// ResolveUvPath returns the app-managed uv binary, falling back to a uv on PATH.
func (u *UvManager) ResolveUvPath() (string, error) {
	managed := u.ManagedUvPath()
	if _, err := os.Stat(managed); err == nil {
		return managed, nil
	}
	if systemPath, err := exec.LookPath("uv"); err == nil {
		return systemPath, nil
	}
	return "", fmt.Errorf("uv is not installed")
}

// IsAvailable reports whether uv can be used without downloading it first.
func (u *UvManager) IsAvailable() bool {
	_, err := u.ResolveUvPath()
	return err == nil
}

// EnsureUv returns the app-managed uv binary, downloading it when missing so behaviour does not
// depend on whichever uv version the user has installed; a uv on PATH is only used when the
// download is not possible.
func (u *UvManager) EnsureUv() (string, error) {
	managed := u.ManagedUvPath()
	if _, err := os.Stat(managed); err == nil {
		return managed, nil
	}

	downloadErr := u.DownloadUv()
	if downloadErr == nil {
		return managed, nil
	}

	if systemPath, err := exec.LookPath("uv"); err == nil {
		u.log(fmt.Sprintf("uv download failed (%v), using %s", downloadErr, systemPath), "warning")
		return systemPath, nil
	}
	return "", downloadErr
}

// DownloadUv fetches the latest uv release for this platform, verifies its published
// SHA-256 checksum when available, and installs the binary at ManagedUvPath.
func (u *UvManager) DownloadUv() error {
	assetName, err := UvReleaseAsset(runtime.GOOS, runtime.GOARCH)
	if err != nil {
		return err
	}

	u.log(fmt.Sprintf("Downloading uv (%s)...", assetName), "info")

	release, err := fetchLatestRelease(u.releasesURL)
	if err != nil {
		return fmt.Errorf("failed to query uv releases: %w", err)
	}

	var downloadURL, checksumURL string
	for _, asset := range release.Assets {
		switch asset.Name {
		case assetName:
			downloadURL = asset.BrowserDownloadURL
		case assetName + ".sha256":
			checksumURL = asset.BrowserDownloadURL
		}
	}
	if downloadURL == "" {
		return fmt.Errorf("uv release %s has no asset %s", release.TagName, assetName)
	}

	tempDir, err := os.MkdirTemp("", "cupcake-uv-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tempDir)

	archivePath := filepath.Join(tempDir, assetName)
	downloader := NewDownloadManager()
	downloader.SetProgressHandler(u.progressHandler)
	if err := downloader.DownloadFile(downloadURL, archivePath); err != nil {
		return fmt.Errorf("uv download failed: %w", err)
	}

	if checksumURL != "" {
		if err := verifySHA256(archivePath, checksumURL); err != nil {
			return err
		}
		u.log("uv download verified", "info")
	} else {
		u.log("uv release has no checksum asset, skipping verification", "warning")
	}

	destPath := u.ManagedUvPath()
	if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
		return err
	}
	if err := extractNamedFile(archivePath, uvBinaryName(), destPath); err != nil {
		return err
	}

	u.log(fmt.Sprintf("uv %s installed at %s", release.TagName, destPath), "success")
	return nil
}

// command builds a uv invocation whose interpreters and cache stay inside the app's data directory.
func (u *UvManager) command(uvPath string, args ...string) *exec.Cmd {
	cmd := exec.Command(uvPath, args...)
	cmd.Env = append(os.Environ(),
		"UV_PYTHON_INSTALL_DIR="+filepath.Join(u.uvRoot(), "python"),
		"UV_CACHE_DIR="+filepath.Join(u.uvRoot(), "cache"),
		"UV_NO_PROGRESS=1",
	)
	hideWindow(cmd)
	return cmd
}

// InstallPython installs a uv-managed interpreter without adding launchers to the user's bin
// directory or the Windows registry, and returns the path to its executable.
func (u *UvManager) InstallPython(version string) (string, error) {
	uvPath, err := u.EnsureUv()
	if err != nil {
		return "", err
	}

	u.log(fmt.Sprintf("Installing Python %s with uv...", version), "info")
	if err := u.stream(u.command(uvPath, "python", "install", "--no-bin", "--no-registry", version)); err != nil {
		u.log("Retrying without --no-bin/--no-registry for an older uv", "warning")
		if retryErr := u.stream(u.command(uvPath, "python", "install", version)); retryErr != nil {
			return "", fmt.Errorf("uv python install %s failed: %w", version, err)
		}
	}

	output, err := u.command(uvPath, "python", "find", "--python-preference", "only-managed", version).Output()
	if err != nil {
		return "", fmt.Errorf("uv could not locate the installed Python %s: %w", version, err)
	}

	interpreter := strings.TrimSpace(string(output))
	u.log(fmt.Sprintf("Python %s ready at %s", version, interpreter), "success")
	return interpreter, nil
}

// CreateVenv creates a virtual environment seeded with pip at venvDir using the given interpreter
// and returns the environment's Python executable.
func (u *UvManager) CreateVenv(interpreter, venvDir string) (string, error) {
	uvPath, err := u.EnsureUv()
	if err != nil {
		return "", err
	}

	output, err := u.command(uvPath, "venv", "--seed", "--python", interpreter, venvDir).CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("uv venv failed: %w, output: %s", err, string(output))
	}

	return venvPythonPath(venvDir), nil
}

// InstallRequirements installs a requirements file into the environment owning venvPython.
func (u *UvManager) InstallRequirements(venvPython, requirementsPath string) error {
	uvPath, err := u.EnsureUv()
	if err != nil {
		return err
	}
	if err := u.stream(u.command(uvPath, "pip", "install", "--python", venvPython, "-r", requirementsPath)); err != nil {
		return fmt.Errorf("uv pip install failed: %w", err)
	}
	return nil
}

func (u *UvManager) stream(cmd *exec.Cmd) error {
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	cmd.Stderr = cmd.Stdout

	if err := cmd.Start(); err != nil {
		return err
	}

	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		if line := strings.TrimSpace(scanner.Text()); line != "" {
			u.log(line, "info")
		}
	}

	return cmd.Wait()
}

func venvPythonPath(venvDir string) string {
	if runtime.GOOS == "windows" {
		return filepath.Join(venvDir, "Scripts", "python.exe")
	}
	return filepath.Join(venvDir, "bin", "python")
}

func fetchLatestRelease(url string) (*githubRelease, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API returned status %d", resp.StatusCode)
	}

	var release githubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return nil, err
	}
	return &release, nil
}

func verifySHA256(filePath, checksumURL string) error {
	resp, err := http.Get(checksumURL)
	if err != nil {
		return fmt.Errorf("failed to download checksum: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("checksum download returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	fields := strings.Fields(string(body))
	if len(fields) == 0 {
		return fmt.Errorf("checksum file is empty")
	}
	expected := strings.ToLower(fields[0])

	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	hasher := sha256.New()
	if _, err := io.Copy(hasher, file); err != nil {
		return err
	}
	actual := hex.EncodeToString(hasher.Sum(nil))

	if actual != expected {
		return fmt.Errorf("uv checksum mismatch: expected %s, got %s", expected, actual)
	}
	return nil
}

// extractNamedFile copies the first archive entry whose base name is fileName to destPath,
// regardless of how deeply the archive nests it.
func extractNamedFile(archivePath, fileName, destPath string) error {
	if strings.HasSuffix(archivePath, ".zip") {
		return extractNamedFileFromZip(archivePath, fileName, destPath)
	}
	return extractNamedFileFromTarGz(archivePath, fileName, destPath)
}

func extractNamedFileFromTarGz(archivePath, fileName, destPath string) error {
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
	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		if header.Typeflag == tar.TypeReg && path.Base(header.Name) == fileName {
			return writeExecutable(tr, destPath)
		}
	}
	return fmt.Errorf("%s not found in %s", fileName, filepath.Base(archivePath))
}

func extractNamedFileFromZip(archivePath, fileName, destPath string) error {
	r, err := zip.OpenReader(archivePath)
	if err != nil {
		return err
	}
	defer r.Close()

	for _, f := range r.File {
		if f.FileInfo().IsDir() || path.Base(f.Name) != fileName {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return err
		}
		defer rc.Close()
		return writeExecutable(rc, destPath)
	}
	return fmt.Errorf("%s not found in %s", fileName, filepath.Base(archivePath))
}

func writeExecutable(src io.Reader, destPath string) error {
	tempPath := destPath + ".tmp"
	out, err := os.OpenFile(tempPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0755)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, src); err != nil {
		out.Close()
		os.Remove(tempPath)
		return err
	}
	if err := out.Close(); err != nil {
		os.Remove(tempPath)
		return err
	}
	os.Remove(destPath)
	return os.Rename(tempPath, destPath)
}
