package services

import (
	"os"
	"path/filepath"
	"testing"
)

func TestAnUpdateKeepsTheDataFolderAndBackups(t *testing.T) {
	backend := filepath.Join(t.TempDir(), "backend")
	keep := []string{
		filepath.Join("cupcake-vanilla", "cupcake_vanilla.db"),
		filepath.Join("cupcake-vanilla", "media", "uploads", "sample.raw"),
		filepath.Join("cupcake-vanilla", "secret_key"),
		filepath.Join("backups", "cupcake-db-2026-11-17.sqlite3.gz"),
	}
	remove := []string{
		filepath.Join("cupcake_vanilla", "settings.py"),
		filepath.Join("python", "bin", "python3"),
		"manage.py",
	}
	for _, name := range append(keep, remove...) {
		path := filepath.Join(backend, name)
		os.MkdirAll(filepath.Dir(path), 0755)
		os.WriteFile(path, []byte(name), 0600)
	}

	updater := NewBackendUpdater(t.TempDir(), nil, nil, nil)
	if err := updater.cleanBackendPreservingData(backend); err != nil {
		t.Fatal(err)
	}
	for _, name := range keep {
		if _, err := os.Stat(filepath.Join(backend, name)); err != nil {
			t.Errorf("%s was removed by the update", name)
		}
	}
	for _, name := range remove {
		if _, err := os.Stat(filepath.Join(backend, name)); err == nil {
			t.Errorf("%s was kept, but belongs to the old backend", name)
		}
	}
}
