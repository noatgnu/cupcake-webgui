package services

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/noatgnu/cupcake/cupcake-wails/backend/models"
)

const (
	ValkeyVersion       = "7.2.11"
	RedisWindowsVersion = "5.0.14.1"
)

type ValkeyDownloader struct {
	progressHandler func(models.DownloadProgress)
	downloadManager *DownloadManager
}

func NewValkeyDownloader(progressHandler func(models.DownloadProgress)) *ValkeyDownloader {
	dm := NewDownloadManager()
	dm.SetProgressHandler(progressHandler)

	return &ValkeyDownloader{
		progressHandler: progressHandler,
		downloadManager: dm,
	}
}

func (v *ValkeyDownloader) getDownloadURL() string {
	if runtime.GOOS == "windows" {
		return fmt.Sprintf("https://github.com/tporadowski/redis/releases/download/v%s/Redis-x64-%s.zip",
			RedisWindowsVersion, RedisWindowsVersion)
	}

	ubuntuRelease := v.getUbuntuRelease()
	return fmt.Sprintf("https://download.valkey.io/releases/valkey-%s-%s-x86_64.tar.gz",
		ValkeyVersion, ubuntuRelease)
}

func (v *ValkeyDownloader) getUbuntuRelease() string {
	return "noble"
}

func (v *ValkeyDownloader) CheckSystemRedis(destPath string) bool {
	systemPaths := []string{"/usr/bin/redis-server", "/usr/local/bin/redis-server"}

	for _, systemPath := range systemPaths {
		if _, err := os.Stat(systemPath); err == nil {
			log.Printf("[ValkeyDownloader] Found system Redis at %s", systemPath)

			os.MkdirAll(destPath, 0755)
			destBinary := filepath.Join(destPath, "valkey-server")

			input, err := os.Open(systemPath)
			if err != nil {
				continue
			}

			output, err := os.Create(destBinary)
			if err != nil {
				input.Close()
				continue
			}

			_, err = io.Copy(output, input)
			input.Close()
			output.Close()

			if err != nil {
				continue
			}

			os.Chmod(destBinary, 0755)
			log.Printf("[ValkeyDownloader] Copied system Redis to %s", destBinary)
			return true
		}
	}

	return false
}

func (v *ValkeyDownloader) DownloadValkey(destPath string) error {
	if os.Getenv("CUPCAKE_TEST_MODE") == "true" {
		return nil
	}

	if runtime.GOOS == "linux" {
		if v.CheckSystemRedis(destPath) {
			return nil
		}
	}

	url := v.getDownloadURL()
	log.Printf("[ValkeyDownloader] Downloading from: %s", url)

	var fileExt string
	if runtime.GOOS == "windows" {
		fileExt = ".zip"
	} else {
		fileExt = ".tar.gz"
	}

	tempFile := filepath.Join(os.TempDir(), fmt.Sprintf("valkey_%d%s", os.Getpid(), fileExt))
	defer os.Remove(tempFile)

	if err := v.downloadManager.DownloadFile(url, tempFile); err != nil {
		return fmt.Errorf("download failed: %w", err)
	}

	if runtime.GOOS == "windows" {
		return v.extractZip(tempFile, destPath)
	}
	return v.extractTarGz(tempFile, destPath)
}

func (v *ValkeyDownloader) extractTarGz(archivePath, destPath string) error {
	log.Printf("[ValkeyDownloader] Extracting tar.gz to %s", destPath)

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

	var foundBinaries []string

	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		name := header.Name

		if header.Typeflag == tar.TypeReg {
			baseName := filepath.Base(name)

			if strings.HasPrefix(baseName, "valkey-") || strings.HasPrefix(baseName, "redis-") {
				destFile := filepath.Join(destPath, baseName)

				outFile, err := os.Create(destFile)
				if err != nil {
					return err
				}

				if _, err := io.Copy(outFile, tr); err != nil {
					outFile.Close()
					return err
				}
				outFile.Close()

				os.Chmod(destFile, 0755)
				foundBinaries = append(foundBinaries, baseName)
			}
		}
	}

	if len(foundBinaries) == 0 {
		return fmt.Errorf("no valkey/redis binaries found in archive")
	}

	log.Printf("[ValkeyDownloader] Extracted binaries: %v", foundBinaries)
	return nil
}

func (v *ValkeyDownloader) extractZip(archivePath, destPath string) error {
	log.Printf("[ValkeyDownloader] Extracting zip to %s", destPath)

	r, err := zip.OpenReader(archivePath)
	if err != nil {
		return err
	}
	defer r.Close()

	if err := os.MkdirAll(destPath, 0755); err != nil {
		return err
	}

	var foundBinaries []string

	for _, f := range r.File {
		name := f.Name
		baseName := filepath.Base(name)

		if strings.HasSuffix(baseName, ".exe") ||
			strings.HasSuffix(baseName, ".dll") ||
			strings.HasSuffix(baseName, ".conf") {

			destFile := filepath.Join(destPath, baseName)

			rc, err := f.Open()
			if err != nil {
				return err
			}

			outFile, err := os.Create(destFile)
			if err != nil {
				rc.Close()
				return err
			}

			_, err = io.Copy(outFile, rc)
			outFile.Close()
			rc.Close()

			if err != nil {
				return err
			}

			foundBinaries = append(foundBinaries, baseName)
		}
	}

	if len(foundBinaries) == 0 {
		return fmt.Errorf("no redis binaries found in archive")
	}

	log.Printf("[ValkeyDownloader] Extracted files: %v", foundBinaries)
	return nil
}

func (v *ValkeyDownloader) createMockValkeyBinary(destPath string) error {
	return nil
}

func (v *ValkeyDownloader) ValkeyExists(valkeyPath string) bool {
	var serverPath string
	if runtime.GOOS == "windows" {
		serverPath = filepath.Join(valkeyPath, "redis-server.exe")
	} else {
		serverPath = filepath.Join(valkeyPath, "valkey-server")
		if _, err := os.Stat(serverPath); os.IsNotExist(err) {
			serverPath = filepath.Join(valkeyPath, "redis-server")
		}
	}

	_, err := os.Stat(serverPath)
	return err == nil
}
