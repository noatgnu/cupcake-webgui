package services

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func TestNewBackupManager(t *testing.T) {
	testDataPath := filepath.Join(os.TempDir(), "cupcake-backup-test")
	defer os.RemoveAll(testDataPath)

	if err := os.MkdirAll(testDataPath, 0755); err != nil {
		t.Fatalf("Failed to create test data path: %v", err)
	}

	redisManager := NewRedisManager(RedisManagerOptions{
		UserDataPath: testDataPath,
		IsDev:        true,
	})
	backendManager := NewBackendManager(testDataPath, true, redisManager)
	backupManager := NewBackupManager(testDataPath, backendManager, nil)

	if backupManager == nil {
		t.Fatal("NewBackupManager returned nil")
	}

	if backupManager.backupDir == "" {
		t.Error("Backup directory should not be empty")
	}

	expectedBackupDir := filepath.Join(testDataPath, "backend", "backups")
	if backupManager.backupDir != expectedBackupDir {
		t.Errorf("Expected backup dir %s, got %s", expectedBackupDir, backupManager.backupDir)
	}

	if _, err := os.Stat(backupManager.backupDir); os.IsNotExist(err) {
		t.Error("Backup directory should be created")
	}
}

func TestBackupManagerLogCallback(t *testing.T) {
	testDataPath := filepath.Join(os.TempDir(), "cupcake-backup-test-log")
	defer os.RemoveAll(testDataPath)

	if err := os.MkdirAll(testDataPath, 0755); err != nil {
		t.Fatalf("Failed to create test data path: %v", err)
	}

	redisManager := NewRedisManager(RedisManagerOptions{
		UserDataPath: testDataPath,
		IsDev:        true,
	})
	backendManager := NewBackendManager(testDataPath, true, redisManager)
	backupManager := NewBackupManager(testDataPath, backendManager, nil)

	logReceived := false
	var receivedMessage string
	var receivedType string

	backupManager.SetLogCallback(func(message string, msgType string) {
		logReceived = true
		receivedMessage = message
		receivedType = msgType
	})

	backupManager.log("Test message", "info")

	if !logReceived {
		t.Error("Log callback was not called")
	}
	if receivedMessage != "Test message" {
		t.Errorf("Expected message 'Test message', got '%s'", receivedMessage)
	}
	if receivedType != "info" {
		t.Errorf("Expected type 'info', got '%s'", receivedType)
	}
}

func TestGetBackupDir(t *testing.T) {
	testDataPath := filepath.Join(os.TempDir(), "cupcake-backup-test-dir")
	defer os.RemoveAll(testDataPath)

	if err := os.MkdirAll(testDataPath, 0755); err != nil {
		t.Fatalf("Failed to create test data path: %v", err)
	}

	redisManager := NewRedisManager(RedisManagerOptions{
		UserDataPath: testDataPath,
		IsDev:        true,
	})
	backendManager := NewBackendManager(testDataPath, true, redisManager)
	backupManager := NewBackupManager(testDataPath, backendManager, nil)

	backupDir := backupManager.GetBackupDir()

	expectedDir := filepath.Join(testDataPath, "backend", "backups")
	if backupDir != expectedDir {
		t.Errorf("Expected backup dir %s, got %s", expectedDir, backupDir)
	}
}

func TestListBackupsEmptyDirectory(t *testing.T) {
	testDataPath := filepath.Join(os.TempDir(), "cupcake-backup-test-list")
	defer os.RemoveAll(testDataPath)

	if err := os.MkdirAll(testDataPath, 0755); err != nil {
		t.Fatalf("Failed to create test data path: %v", err)
	}

	redisManager := NewRedisManager(RedisManagerOptions{
		UserDataPath: testDataPath,
		IsDev:        true,
	})
	backendManager := NewBackendManager(testDataPath, true, redisManager)
	backupManager := NewBackupManager(testDataPath, backendManager, nil)

	backups, err := backupManager.ListBackups()
	if err != nil {
		t.Fatalf("ListBackups failed: %v", err)
	}

	if len(backups) != 0 {
		t.Errorf("Expected 0 backups, got %d", len(backups))
	}
}

func TestListBackupsWithFiles(t *testing.T) {
	testDataPath := filepath.Join(os.TempDir(), "cupcake-backup-test-files")
	defer os.RemoveAll(testDataPath)

	if err := os.MkdirAll(testDataPath, 0755); err != nil {
		t.Fatalf("Failed to create test data path: %v", err)
	}

	redisManager := NewRedisManager(RedisManagerOptions{
		UserDataPath: testDataPath,
		IsDev:        true,
	})
	backendManager := NewBackendManager(testDataPath, true, redisManager)
	backupManager := NewBackupManager(testDataPath, backendManager, nil)

	dbBackupFile := filepath.Join(backupManager.backupDir, "default-2024-01-01-120000.sqlite3")
	if err := os.WriteFile(dbBackupFile, []byte("test db backup"), 0644); err != nil {
		t.Fatalf("Failed to create test db backup file: %v", err)
	}

	mediaBackupFile := filepath.Join(backupManager.backupDir, "media-2024-01-01-120000.tar")
	if err := os.WriteFile(mediaBackupFile, []byte("test media backup"), 0644); err != nil {
		t.Fatalf("Failed to create test media backup file: %v", err)
	}

	nonBackupFile := filepath.Join(backupManager.backupDir, "random.txt")
	if err := os.WriteFile(nonBackupFile, []byte("not a backup"), 0644); err != nil {
		t.Fatalf("Failed to create test non-backup file: %v", err)
	}

	backups, err := backupManager.ListBackups()
	if err != nil {
		t.Fatalf("ListBackups failed: %v", err)
	}

	if len(backups) != 3 {
		t.Errorf("Expected 3 backup files, got %d", len(backups))
	}

	dbFound := false
	mediaFound := false
	for _, b := range backups {
		if b.Name == "default-2024-01-01-120000.sqlite3" {
			dbFound = true
			if b.Type != "database" {
				t.Errorf("Expected database type for db backup, got %s", b.Type)
			}
		}
		if b.Name == "media-2024-01-01-120000.tar" {
			mediaFound = true
			if b.Type != "media" {
				t.Errorf("Expected media type for media backup, got %s", b.Type)
			}
		}
	}

	if !dbFound {
		t.Error("Database backup not found in list")
	}
	if !mediaFound {
		t.Error("Media backup not found in list")
	}
}

func TestDeleteBackup(t *testing.T) {
	testDataPath := filepath.Join(os.TempDir(), "cupcake-backup-test-delete")
	defer os.RemoveAll(testDataPath)

	if err := os.MkdirAll(testDataPath, 0755); err != nil {
		t.Fatalf("Failed to create test data path: %v", err)
	}

	redisManager := NewRedisManager(RedisManagerOptions{
		UserDataPath: testDataPath,
		IsDev:        true,
	})
	backendManager := NewBackendManager(testDataPath, true, redisManager)
	backupManager := NewBackupManager(testDataPath, backendManager, nil)

	backupFile := filepath.Join(backupManager.backupDir, "test-backup.sqlite3.gz")
	if err := os.WriteFile(backupFile, []byte("test backup"), 0644); err != nil {
		t.Fatalf("Failed to create test backup file: %v", err)
	}

	if _, err := os.Stat(backupFile); os.IsNotExist(err) {
		t.Fatal("Backup file should exist before deletion")
	}

	err := backupManager.DeleteBackup(backupFile)
	if err != nil {
		t.Fatalf("DeleteBackup failed: %v", err)
	}

	if _, err := os.Stat(backupFile); !os.IsNotExist(err) {
		t.Error("Backup file should not exist after deletion")
	}
}

func TestDeleteBackupInvalidPath(t *testing.T) {
	testDataPath := filepath.Join(os.TempDir(), "cupcake-backup-test-invalid")
	defer os.RemoveAll(testDataPath)

	if err := os.MkdirAll(testDataPath, 0755); err != nil {
		t.Fatalf("Failed to create test data path: %v", err)
	}

	redisManager := NewRedisManager(RedisManagerOptions{
		UserDataPath: testDataPath,
		IsDev:        true,
	})
	backendManager := NewBackendManager(testDataPath, true, redisManager)
	backupManager := NewBackupManager(testDataPath, backendManager, nil)

	err := backupManager.DeleteBackup("/etc/passwd")
	if err == nil {
		t.Error("DeleteBackup should fail for path outside backup directory")
	}
}

func TestImportDatabaseFromFile(t *testing.T) {
	testDataPath := filepath.Join(os.TempDir(), "cupcake-backup-test-import")
	defer os.RemoveAll(testDataPath)

	if err := os.MkdirAll(testDataPath, 0755); err != nil {
		t.Fatalf("Failed to create test data path: %v", err)
	}

	redisManager := NewRedisManager(RedisManagerOptions{
		UserDataPath: testDataPath,
		IsDev:        true,
	})
	backendManager := NewBackendManager(testDataPath, true, redisManager)
	backupManager := NewBackupManager(testDataPath, backendManager, nil)

	srcContent := []byte("SQLite format 3\x00fake-database-content-for-test")
	srcFile := filepath.Join(testDataPath, "test-import.sqlite3")
	if err := os.WriteFile(srcFile, srcContent, 0644); err != nil {
		t.Fatalf("Failed to create source database file: %v", err)
	}

	backendDir := filepath.Join(testDataPath, "backend")
	if err := backupManager.ImportDatabaseFromFile(srcFile, backendDir); err != nil {
		t.Fatalf("ImportDatabaseFromFile failed: %v", err)
	}

	expectedPath := filepath.Join(backendDir, "cupcake-vanilla", "cupcake_vanilla.db")
	if _, err := os.Stat(expectedPath); os.IsNotExist(err) {
		t.Errorf("Expected database file at %s does not exist", expectedPath)
	}

	importedContent, err := os.ReadFile(expectedPath)
	if err != nil {
		t.Fatalf("Failed to read imported database file: %v", err)
	}

	if !bytes.Equal(importedContent, srcContent) {
		t.Errorf("Imported database content does not match source: got %d bytes, expected %d bytes", len(importedContent), len(srcContent))
	}
}

func TestImportDatabaseFromFileMissingSource(t *testing.T) {
	testDataPath := filepath.Join(os.TempDir(), "cupcake-backup-test-import-missing")
	defer os.RemoveAll(testDataPath)

	if err := os.MkdirAll(testDataPath, 0755); err != nil {
		t.Fatalf("Failed to create test data path: %v", err)
	}

	redisManager := NewRedisManager(RedisManagerOptions{
		UserDataPath: testDataPath,
		IsDev:        true,
	})
	backendManager := NewBackendManager(testDataPath, true, redisManager)
	backupManager := NewBackupManager(testDataPath, backendManager, nil)

	backendDir := filepath.Join(testDataPath, "backend")
	err := backupManager.ImportDatabaseFromFile("/nonexistent/path/db.sqlite3", backendDir)
	if err == nil {
		t.Error("ImportDatabaseFromFile should fail when source file does not exist")
	}
}

func TestExportThenImportDatabase(t *testing.T) {
	testDataPath := filepath.Join(os.TempDir(), "cupcake-backup-test-roundtrip")
	defer os.RemoveAll(testDataPath)

	if err := os.MkdirAll(testDataPath, 0755); err != nil {
		t.Fatalf("Failed to create test data path: %v", err)
	}

	redisManager := NewRedisManager(RedisManagerOptions{
		UserDataPath: testDataPath,
		IsDev:        true,
	})
	backendManager := NewBackendManager(testDataPath, true, redisManager)
	backupManager := NewBackupManager(testDataPath, backendManager, nil)

	exportContent := []byte("SQLite format 3\x00exported-database-content-round-trip-test")

	exportFile := filepath.Join(backupManager.GetBackupDir(), "default-2024-01-01-120000.sqlite3")
	if err := os.WriteFile(exportFile, exportContent, 0644); err != nil {
		t.Fatalf("Failed to write export file: %v", err)
	}

	backups, err := backupManager.ListBackups()
	if err != nil {
		t.Fatalf("ListBackups failed: %v", err)
	}

	var exportedBackup *BackupInfo
	for i := range backups {
		if backups[i].Type == "database" {
			exportedBackup = &backups[i]
			break
		}
	}

	if exportedBackup == nil {
		t.Fatal("No database backup found in list after export")
	}

	backendDir := filepath.Join(testDataPath, "backend")
	if err := backupManager.ImportDatabaseFromFile(exportedBackup.Path, backendDir); err != nil {
		t.Fatalf("ImportDatabaseFromFile failed: %v", err)
	}

	importedPath := filepath.Join(backendDir, "cupcake-vanilla", "cupcake_vanilla.db")
	importedContent, err := os.ReadFile(importedPath)
	if err != nil {
		t.Fatalf("Failed to read imported database file: %v", err)
	}

	if !bytes.Equal(importedContent, exportContent) {
		t.Errorf("Round-trip content mismatch: exported %d bytes, imported %d bytes", len(exportContent), len(importedContent))
	}

	exportStat, err := os.Stat(exportFile)
	if err != nil {
		t.Fatalf("Failed to stat export file: %v", err)
	}
	importStat, err := os.Stat(importedPath)
	if err != nil {
		t.Fatalf("Failed to stat imported file: %v", err)
	}
	if exportStat.Size() != importStat.Size() {
		t.Errorf("File size mismatch: export=%d bytes, import=%d bytes", exportStat.Size(), importStat.Size())
	}
}

func TestImportDatabaseOverwritesExisting(t *testing.T) {
	testDataPath := filepath.Join(os.TempDir(), "cupcake-backup-test-overwrite")
	defer os.RemoveAll(testDataPath)

	if err := os.MkdirAll(testDataPath, 0755); err != nil {
		t.Fatalf("Failed to create test data path: %v", err)
	}

	redisManager := NewRedisManager(RedisManagerOptions{
		UserDataPath: testDataPath,
		IsDev:        true,
	})
	backendManager := NewBackendManager(testDataPath, true, redisManager)
	backupManager := NewBackupManager(testDataPath, backendManager, nil)

	backendDir := filepath.Join(testDataPath, "backend")
	dbDir := filepath.Join(backendDir, "cupcake-vanilla")
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		t.Fatalf("Failed to create db dir: %v", err)
	}

	existingContent := []byte("old-database-content")
	dbPath := filepath.Join(dbDir, "cupcake_vanilla.db")
	if err := os.WriteFile(dbPath, existingContent, 0644); err != nil {
		t.Fatalf("Failed to write existing database: %v", err)
	}

	newContent := []byte("SQLite format 3\x00new-imported-database-content")
	srcFile := filepath.Join(testDataPath, "new-import.sqlite3")
	if err := os.WriteFile(srcFile, newContent, 0644); err != nil {
		t.Fatalf("Failed to create import source file: %v", err)
	}

	if err := backupManager.ImportDatabaseFromFile(srcFile, backendDir); err != nil {
		t.Fatalf("ImportDatabaseFromFile failed: %v", err)
	}

	importedContent, err := os.ReadFile(dbPath)
	if err != nil {
		t.Fatalf("Failed to read database after import: %v", err)
	}

	if !bytes.Equal(importedContent, newContent) {
		t.Errorf("Database was not overwritten: expected new content but got old or corrupted content")
	}
}

func TestDeleteBackupNonExistent(t *testing.T) {
	testDataPath := filepath.Join(os.TempDir(), "cupcake-backup-test-nonexist")
	defer os.RemoveAll(testDataPath)

	if err := os.MkdirAll(testDataPath, 0755); err != nil {
		t.Fatalf("Failed to create test data path: %v", err)
	}

	redisManager := NewRedisManager(RedisManagerOptions{
		UserDataPath: testDataPath,
		IsDev:        true,
	})
	backendManager := NewBackendManager(testDataPath, true, redisManager)
	backupManager := NewBackupManager(testDataPath, backendManager, nil)

	nonExistentFile := filepath.Join(backupManager.backupDir, "non-existent.sqlite3.gz")
	err := backupManager.DeleteBackup(nonExistentFile)
	if err == nil {
		t.Error("DeleteBackup should fail for non-existent file")
	}
}
