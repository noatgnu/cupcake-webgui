package services

import (
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/noatgnu/cupcake/cupcake-wails/backend/models"
)

type DownloadManager struct {
	client           *http.Client
	progressHandler  func(models.DownloadProgress)
	lastDownloadTime int64
	lastDownloaded   int64
	currentSpeed     float64
	isDownloading    bool
	currentProgress  models.DownloadProgress
}

func NewDownloadManager() *DownloadManager {
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS12},
	}

	return &DownloadManager{
		client: &http.Client{
			Transport: transport,
			Timeout:   30 * time.Minute,
		},
	}
}

func (d *DownloadManager) SetProgressHandler(handler func(models.DownloadProgress)) {
	d.progressHandler = handler
}

func (d *DownloadManager) IsDownloading() bool {
	return d.isDownloading
}

func (d *DownloadManager) GetCurrentProgress() models.DownloadProgress {
	return d.currentProgress
}

func (d *DownloadManager) DownloadFile(url, destPath string) error {
	d.isDownloading = true
	d.currentProgress = models.DownloadProgress{}
	defer func() {
		d.isDownloading = false
	}()

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "Cupcake-Vanilla-Wails")

	resp, err := d.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download failed with status: %d", resp.StatusCode)
	}

	file, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer file.Close()

	total := resp.ContentLength
	var downloaded int64
	d.lastDownloadTime = time.Now().UnixMilli()
	d.lastDownloaded = 0
	d.currentSpeed = 0

	buf := make([]byte, 32*1024)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			_, writeErr := file.Write(buf[:n])
			if writeErr != nil {
				return writeErr
			}
			downloaded += int64(n)

			speed := d.calculateSpeed(downloaded)
			percentage := 0
			if total > 0 {
				percentage = int((downloaded * 100) / total)
			}

			d.currentProgress = models.DownloadProgress{
				Downloaded: downloaded,
				Total:      total,
				Percentage: percentage,
				Speed:      speed,
			}

			if d.progressHandler != nil {
				d.progressHandler(d.currentProgress)
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
	}

	return nil
}

func (d *DownloadManager) calculateSpeed(downloaded int64) float64 {
	now := time.Now().UnixMilli()
	timeDiff := float64(now-d.lastDownloadTime) / 1000.0

	if timeDiff >= 0.5 {
		bytesDiff := downloaded - d.lastDownloaded
		d.currentSpeed = float64(bytesDiff) / timeDiff
		d.lastDownloadTime = now
		d.lastDownloaded = downloaded
	}

	return d.currentSpeed
}

func (d *DownloadManager) FollowRedirects(url string) (string, error) {
	client := &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	req, err := http.NewRequest("HEAD", url, nil)
	if err != nil {
		return url, err
	}
	req.Header.Set("User-Agent", "Cupcake-Vanilla-Wails")

	resp, err := client.Do(req)
	if err != nil {
		return url, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 && resp.StatusCode < 400 {
		location := resp.Header.Get("Location")
		if location != "" {
			return d.FollowRedirects(location)
		}
	}

	return url, nil
}
