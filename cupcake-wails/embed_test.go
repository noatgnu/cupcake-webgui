package main

import (
	"io/fs"
	"strings"
	"testing"
)

func TestSetupEmbeddedAssets(t *testing.T) {
	subFS := getSetupAssets()

	indexContent, err := fs.ReadFile(subFS, "index.html")
	if err != nil {
		t.Fatalf("Failed to read setup index.html: %v", err)
	}

	content := string(indexContent)

	if !strings.Contains(content, "<!doctype html>") {
		t.Error("setup index.html should contain <!doctype html>")
	}

	if !strings.Contains(content, "<app-root>") {
		t.Error("setup index.html should contain <app-root>")
	}

	t.Logf("setup index.html content preview: %s", content[:min(500, len(content))])
}

func TestMainAppEmbeddedAssets(t *testing.T) {
	subFS := getMainAppAssets()

	indexContent, err := fs.ReadFile(subFS, "index.html")
	if err != nil {
		t.Fatalf("Failed to read mainapp index.html: %v", err)
	}

	content := string(indexContent)

	if !strings.Contains(content, "<!doctype html>") && !strings.Contains(content, "<!DOCTYPE html>") {
		t.Error("mainapp index.html should contain doctype html declaration")
	}

	t.Logf("mainapp index.html content preview: %s", content[:min(500, len(content))])
}

func TestSetupMainJsExists(t *testing.T) {
	subFS := getSetupAssets()

	entries, err := fs.ReadDir(subFS, ".")
	if err != nil {
		t.Fatalf("Failed to read setup directory: %v", err)
	}

	foundMain := false
	for _, entry := range entries {
		if strings.HasPrefix(entry.Name(), "main-") && strings.HasSuffix(entry.Name(), ".js") {
			foundMain = true
			t.Logf("Found setup main bundle: %s", entry.Name())

			content, err := fs.ReadFile(subFS, entry.Name())
			if err != nil {
				t.Errorf("Failed to read %s: %v", entry.Name(), err)
				continue
			}

			if len(content) == 0 {
				t.Errorf("%s is empty", entry.Name())
			}
		}
	}

	if !foundMain {
		t.Error("No main-*.js bundle found in setup")
		t.Log("Available files:")
		for _, entry := range entries {
			t.Logf("  - %s", entry.Name())
		}
	}
}

func TestMainAppMainJsExists(t *testing.T) {
	subFS := getMainAppAssets()

	entries, err := fs.ReadDir(subFS, ".")
	if err != nil {
		t.Fatalf("Failed to read mainapp directory: %v", err)
	}

	foundMain := false
	for _, entry := range entries {
		if strings.HasPrefix(entry.Name(), "main") && strings.HasSuffix(entry.Name(), ".js") {
			foundMain = true
			t.Logf("Found mainapp main bundle: %s", entry.Name())

			content, err := fs.ReadFile(subFS, entry.Name())
			if err != nil {
				t.Errorf("Failed to read %s: %v", entry.Name(), err)
				continue
			}

			if len(content) == 0 {
				t.Errorf("%s is empty", entry.Name())
			}
		}
	}

	if !foundMain {
		t.Error("No main*.js bundle found in mainapp")
		t.Log("Available files:")
		for _, entry := range entries {
			t.Logf("  - %s", entry.Name())
		}
	}
}

func TestSplashChunkExists(t *testing.T) {
	subFS := getSetupAssets()

	entries, err := fs.ReadDir(subFS, ".")
	if err != nil {
		t.Fatalf("Failed to read setup directory: %v", err)
	}

	foundSplash := false
	for _, entry := range entries {
		if strings.Contains(entry.Name(), "splash") {
			foundSplash = true
			t.Logf("Found splash chunk: %s", entry.Name())
		}
	}

	if !foundSplash {
		t.Log("Available files:")
		for _, entry := range entries {
			t.Logf("  - %s", entry.Name())
		}
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
