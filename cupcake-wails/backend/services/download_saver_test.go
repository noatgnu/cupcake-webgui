package services

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestSaveDownloadWritesResponseBody(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Disposition", `attachment; filename="table.sdrf.tsv"`)
		w.Write([]byte("source name\tcharacteristics[organism]\n"))
	}))
	defer server.Close()

	destDir := t.TempDir()
	saved, err := SaveDownload(server.URL+"/api/v1/async-tasks/1/download/?token=x", "", "", destDir)
	if err != nil {
		t.Fatalf("download failed: %v", err)
	}
	if filepath.Base(saved) != "table.sdrf.tsv" {
		t.Errorf("expected the Content-Disposition filename, got %s", filepath.Base(saved))
	}
	assertFileContent(t, saved, "source name\tcharacteristics[organism]\n")
}

func TestSaveDownloadResolvesAccelRedirectFromMediaRoot(t *testing.T) {
	mediaRoot := t.TempDir()
	resultDir := filepath.Join(mediaRoot, "temp_files", "2026", "10")
	if err := os.MkdirAll(resultDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(resultDir, "export file.xlsx"), []byte("PK-excel"), 0644); err != nil {
		t.Fatal(err)
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Accel-Redirect", "/internal/media/temp_files/2026/10/export%20file.xlsx")
		w.Header().Set("Content-Disposition", `attachment; filename="export.xlsx"`)
	}))
	defer server.Close()

	saved, err := SaveDownload(server.URL, "export.xlsx", mediaRoot, t.TempDir())
	if err != nil {
		t.Fatalf("download failed: %v", err)
	}
	assertFileContent(t, saved, "PK-excel")
}

func TestSaveDownloadRejectsAccelRedirectOutsideMediaRoot(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Accel-Redirect", "/internal/media/../../etc/passwd")
	}))
	defer server.Close()

	destDir := t.TempDir()
	if _, err := SaveDownload(server.URL, "passwd", t.TempDir(), destDir); err == nil {
		t.Fatal("expected a redirect escaping the media folder to be rejected")
	}
	if entries, _ := os.ReadDir(destDir); len(entries) != 0 {
		t.Errorf("expected nothing to be written, found %d files", len(entries))
	}
}

func TestSaveDownloadNeverOverwritesAndSanitisesNames(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("new"))
	}))
	defer server.Close()

	destDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(destDir, "result.tsv"), []byte("old"), 0644); err != nil {
		t.Fatal(err)
	}

	saved, err := SaveDownload(server.URL, "../../result.tsv", "", destDir)
	if err != nil {
		t.Fatalf("download failed: %v", err)
	}
	if saved != filepath.Join(destDir, "result (1).tsv") {
		t.Errorf("expected a numbered file inside the destination, got %s", saved)
	}
	assertFileContent(t, filepath.Join(destDir, "result.tsv"), "old")
	assertFileContent(t, saved, "new")
}

func TestSaveDownloadReportsHTTPErrors(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "Invalid or expired token", http.StatusForbidden)
	}))
	defer server.Close()

	if _, err := SaveDownload(server.URL, "x.tsv", "", t.TempDir()); err == nil {
		t.Fatal("expected an error for a 403 response")
	}
}
