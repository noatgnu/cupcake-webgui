package services

import (
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// accelMediaPrefix is the internal location the backend hands to nginx via X-Accel-Redirect
// for task result files under MEDIA_ROOT.
const accelMediaPrefix = "/internal/media/"

// UserDownloadsDir returns the user's Downloads folder, creating it when missing.
func UserDownloadsDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, "Downloads")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}
	return dir, nil
}

// SaveDownload fetches downloadURL into destDir and returns the saved file's path. When the
// backend answers with an nginx X-Accel-Redirect into its media folder, which happens because
// no nginx sits in front of the desktop backend, the file is read straight from mediaRoot.
// An existing file is never overwritten; a numbered name is chosen instead.
func SaveDownload(downloadURL, filename, mediaRoot, destDir string) (string, error) {
	resp, err := http.Get(downloadURL)
	if err != nil {
		return "", fmt.Errorf("download request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("download failed with status %d", resp.StatusCode)
	}

	if filename == "" {
		filename = downloadFilename(resp, downloadURL)
	}
	filename = filepath.Base(filepath.Clean("/" + filename))
	if filename == "/" || filename == "." {
		filename = "download"
	}

	var source io.Reader = resp.Body
	if accel := resp.Header.Get("X-Accel-Redirect"); accel != "" {
		mediaFile, err := resolveAccelMediaPath(accel, mediaRoot)
		if err != nil {
			return "", err
		}
		file, err := os.Open(mediaFile)
		if err != nil {
			return "", fmt.Errorf("failed to open %s: %w", mediaFile, err)
		}
		defer file.Close()
		source = file
	}

	if err := os.MkdirAll(destDir, 0755); err != nil {
		return "", err
	}
	out, destPath, err := createUniqueFile(destDir, filename)
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(out, source); err != nil {
		out.Close()
		os.Remove(destPath)
		return "", fmt.Errorf("failed to save download: %w", err)
	}
	if err := out.Close(); err != nil {
		os.Remove(destPath)
		return "", err
	}
	return destPath, nil
}

func resolveAccelMediaPath(accel, mediaRoot string) (string, error) {
	if mediaRoot == "" || !strings.HasPrefix(accel, accelMediaPrefix) {
		return "", fmt.Errorf("unsupported X-Accel-Redirect target %q", accel)
	}
	relative, err := url.PathUnescape(strings.TrimPrefix(accel, accelMediaPrefix))
	if err != nil {
		return "", err
	}
	candidate := filepath.Join(mediaRoot, filepath.FromSlash(relative))
	rel, err := filepath.Rel(mediaRoot, candidate)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("X-Accel-Redirect target %q escapes the media folder", accel)
	}
	return candidate, nil
}

func downloadFilename(resp *http.Response, downloadURL string) string {
	if _, params, err := mime.ParseMediaType(resp.Header.Get("Content-Disposition")); err == nil && params["filename"] != "" {
		return params["filename"]
	}
	if parsed, err := url.Parse(downloadURL); err == nil {
		if base := path.Base(parsed.Path); base != "/" && base != "." {
			return base
		}
	}
	return "download"
}

func createUniqueFile(dir, filename string) (*os.File, string, error) {
	ext := filepath.Ext(filename)
	stem := strings.TrimSuffix(filename, ext)
	for i := 0; i < 1000; i++ {
		name := filename
		if i > 0 {
			name = fmt.Sprintf("%s (%d)%s", stem, i, ext)
		}
		candidate := filepath.Join(dir, name)
		file, err := os.OpenFile(candidate, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0644)
		if err == nil {
			return file, candidate, nil
		}
		if !os.IsExist(err) {
			return nil, "", err
		}
	}
	return nil, "", fmt.Errorf("could not find a free file name for %s in %s", filename, dir)
}
