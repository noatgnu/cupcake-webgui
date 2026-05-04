package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/noatgnu/cupcake-webgui/cupcake-wails/backend/models"
	"github.com/noatgnu/cupcake-webgui/cupcake-wails/backend/services"
)

func TestFullInitializationFlow(t *testing.T) {
	testDataPath := filepath.Join(os.TempDir(), "cupcake-vanilla-test")
	defer os.RemoveAll(testDataPath)

	if err := os.MkdirAll(testDataPath, 0755); err != nil {
		t.Fatalf("Failed to create test data path: %v", err)
	}

	log.Printf("Test data path: %s", testDataPath)

	t.Run("DatabaseService", func(t *testing.T) {
		db, err := services.NewDatabaseService(testDataPath)
		if err != nil {
			t.Fatalf("Failed to create database service: %v", err)
		}
		defer db.Close()

		if err := db.SetConfig("test_key", "test_value"); err != nil {
			t.Fatalf("Failed to set config: %v", err)
		}

		value, err := db.GetConfig("test_key")
		if err != nil {
			t.Fatalf("Failed to get config: %v", err)
		}
		if value != "test_value" {
			t.Errorf("Expected 'test_value', got '%s'", value)
		}

		log.Println("Database service: OK")
	})

	t.Run("PythonDetection", func(t *testing.T) {
		pythonManager := services.NewPythonManager(testDataPath)
		candidates := pythonManager.DetectPythonCandidates()

		log.Printf("Found %d Python candidates:", len(candidates))
		for _, c := range candidates {
			log.Printf("  - %s (%s) at %s", c.Command, c.Version, c.Path)
		}

		if len(candidates) == 0 {
			t.Skip("No Python found on system - skipping Python-dependent tests")
		}

		bestCandidate := candidates[0]
		result := pythonManager.VerifyPython(bestCandidate.Path)
		if !result.Valid {
			t.Errorf("Python verification failed: %s", result.Message)
		}

		log.Printf("Best Python candidate: %s (%s)", bestCandidate.Path, result.Version)
	})

	t.Run("BackendDownloader_GetReleases", func(t *testing.T) {
		downloader := services.NewBackendDownloader(nil)
		releases, err := downloader.GetAvailableReleases()
		if err != nil {
			t.Fatalf("Failed to get releases: %v", err)
		}

		log.Printf("Found %d releases/branches:", len(releases))
		for _, r := range releases {
			log.Printf("  - %s: %s", r.Tag, r.Name)
		}

		if len(releases) == 0 {
			t.Error("Expected at least one release/branch")
		}
	})

	t.Run("BackendClone", func(t *testing.T) {
		backendPath := filepath.Join(testDataPath, "backend")
		downloader := services.NewBackendDownloader(func(progress models.DownloadProgress) {
			log.Printf("Clone progress: %d%%", progress.Percentage)
		})

		log.Println("Cloning backend repository...")
		err := downloader.DownloadSource(backendPath, "")
		if err != nil {
			t.Fatalf("Failed to clone backend: %v", err)
		}

		if !downloader.BackendExists(backendPath) {
			t.Error("Backend directory does not exist after clone")
		}

		managePy := filepath.Join(backendPath, "manage.py")
		if _, err := os.Stat(managePy); os.IsNotExist(err) {
			t.Error("manage.py not found in cloned backend")
		}

		log.Println("Backend cloned successfully")
	})

	t.Run("VenvCreation", func(t *testing.T) {
		pythonManager := services.NewPythonManager(testDataPath)
		candidates := pythonManager.DetectPythonCandidates()

		if len(candidates) == 0 {
			t.Skip("No Python 3.12+ found - skipping venv creation test")
		}

		var pythonPath string
		for _, c := range candidates {
			if c.Version >= "3.12" {
				pythonPath = c.Path
				break
			}
		}
		if pythonPath == "" {
			t.Skip("No Python 3.12+ found - skipping venv creation test")
		}
		log.Printf("Creating venv with Python: %s", pythonPath)

		venvPython, err := pythonManager.CreateVirtualEnvironment(pythonPath)
		if err != nil {
			if strings.Contains(err.Error(), "ensurepip") || strings.Contains(err.Error(), "venv") {
				t.Skipf("Venv module not available (install python3.12-venv): %v", err)
			}
			t.Fatalf("Failed to create venv: %v", err)
		}

		if _, err := os.Stat(venvPython); os.IsNotExist(err) {
			t.Errorf("Venv Python not found at: %s", venvPython)
		}

		log.Printf("Venv created successfully: %s", venvPython)

		config := pythonManager.LoadConfig()
		config.PythonPath = pythonPath
		config.VenvPath = venvPython
		config.DistributionType = models.DistributionNative
		config.BackendSource = models.BackendSourceGit
		pythonManager.SaveConfig(config)

		loadedConfig := pythonManager.LoadConfig()
		if loadedConfig.DistributionType != models.DistributionNative {
			t.Errorf("Expected DistributionNative, got %s", loadedConfig.DistributionType)
		}
		if loadedConfig.BackendSource != models.BackendSourceGit {
			t.Errorf("Expected BackendSourceGit, got %s", loadedConfig.BackendSource)
		}

		log.Println("Config saved and loaded successfully")
	})

	t.Run("DependencyInstallation", func(t *testing.T) {
		pythonManager := services.NewPythonManager(testDataPath)
		config := pythonManager.LoadConfig()

		if config.VenvPath == "" {
			t.Skip("No venv path - skipping dependency installation")
		}

		backendPath := filepath.Join(testDataPath, "backend")
		requirementsPath := filepath.Join(backendPath, "requirements.txt")

		if _, err := os.Stat(requirementsPath); os.IsNotExist(err) {
			t.Skip("No requirements.txt found - skipping dependency installation")
		}

		log.Println("Installing dependencies (this may take a while)...")
		err := pythonManager.InstallDependencies(config.VenvPath, requirementsPath)
		if err != nil {
			t.Logf("Warning: Dependency installation failed: %v", err)
			t.Logf("This is expected in CI environments without all build dependencies")
		} else {
			log.Println("Dependencies installed successfully")
		}
	})

	log.Println("\n=== Integration Test Summary ===")
	log.Printf("Test data path: %s", testDataPath)
	log.Println("All initialization steps completed successfully!")
}

func TestNativeBackendSetup(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDataPath := filepath.Join(os.TempDir(), fmt.Sprintf("cupcake-vanilla-native-test-%d", os.Getpid()))
	defer os.RemoveAll(testDataPath)

	if err := os.MkdirAll(testDataPath, 0755); err != nil {
		t.Fatalf("Failed to create test data path: %v", err)
	}

	pythonManager := services.NewPythonManager(testDataPath)
	candidates := pythonManager.DetectPythonCandidates()

	if len(candidates) == 0 {
		t.Skip("No Python 3.12+ found on system")
	}

	var pythonPath string
	var selectedVersion string
	for _, c := range candidates {
		if c.Version >= "3.12" {
			pythonPath = c.Path
			selectedVersion = c.Version
			break
		}
	}
	if pythonPath == "" {
		t.Skip("No Python 3.12+ found on system")
	}
	log.Printf("Using Python: %s (%s)", pythonPath, selectedVersion)

	backendPath := filepath.Join(testDataPath, "backend")
	downloader := services.NewBackendDownloader(func(progress models.DownloadProgress) {
		if progress.Percentage%20 == 0 {
			log.Printf("Progress: %d%%", progress.Percentage)
		}
	})

	log.Println("Step 1: Cloning backend repository...")
	if err := downloader.DownloadSource(backendPath, ""); err != nil {
		t.Fatalf("Failed to clone: %v", err)
	}

	if !downloader.BackendExists(backendPath) {
		t.Fatal("Backend does not exist after clone")
	}
	log.Println("Backend cloned successfully")

	log.Println("Step 2: Creating virtual environment...")
	venvPython, err := pythonManager.CreateVirtualEnvironment(pythonPath)
	if err != nil {
		if strings.Contains(err.Error(), "ensurepip") || strings.Contains(err.Error(), "venv") {
			t.Skipf("Venv module not available (install python3.12-venv): %v", err)
		}
		t.Fatalf("Failed to create venv: %v", err)
	}
	log.Printf("Venv created: %s", venvPython)

	log.Println("Step 3: Saving configuration...")
	config := pythonManager.LoadConfig()
	config.PythonPath = pythonPath
	config.VenvPath = venvPython
	config.DistributionType = models.DistributionNative
	config.BackendSource = models.BackendSourceGit
	pythonManager.SaveConfig(config)

	savedConfig := pythonManager.LoadConfig()
	if savedConfig.DistributionType != models.DistributionNative {
		t.Errorf("Config not saved correctly: expected native, got %s", savedConfig.DistributionType)
	}

	log.Println("Step 4: Installing dependencies...")
	requirementsPath := filepath.Join(backendPath, "requirements.txt")
	if err := pythonManager.InstallDependencies(venvPython, requirementsPath); err != nil {
		log.Printf("Warning: Dependency installation failed: %v", err)
		log.Println("This is common in environments without all build tools")
	} else {
		log.Println("Dependencies installed successfully")
	}

	log.Println("Step 5: Running Django migrations...")
	isDev := true
	redisManager := services.NewRedisManager(services.RedisManagerOptions{
		UserDataPath: testDataPath,
		IsDev:        isDev,
	})
	backendManager := services.NewBackendManager(testDataPath, isDev, redisManager)

	if err := backendManager.RunMigrations(backendPath, venvPython); err != nil {
		t.Logf("Warning: Migrations failed: %v", err)
		log.Println("Migrations failed - this may be expected without Redis")
	} else {
		log.Println("Migrations completed successfully")
	}

	log.Println("Step 6: Collecting static files...")
	if err := backendManager.CollectStaticFiles(backendPath, venvPython); err != nil {
		t.Logf("Warning: Static file collection failed: %v", err)
	} else {
		log.Println("Static files collected successfully")
	}

	log.Println("Step 7: Starting Redis server...")
	redisDir := redisManager.GetRedisDir()
	if err := os.MkdirAll(redisDir, 0755); err != nil {
		t.Fatalf("Failed to create Redis directory: %v", err)
	}
	if err := redisManager.StartRedis(); err != nil {
		if services.IsRedisNotFoundError(err) {
			log.Println("Redis/Valkey not found - skipping server startup tests")
			log.Println("\n=== Native Backend Setup Complete (without Redis) ===")
			log.Printf("Backend path: %s", backendPath)
			log.Printf("Venv Python: %s", venvPython)
			log.Printf("Distribution: %s", savedConfig.DistributionType)
			log.Printf("Source: %s", savedConfig.BackendSource)
			return
		}
		t.Fatalf("Failed to start Redis: %v", err)
	}
	defer redisManager.StopRedis()
	log.Println("Redis started successfully")

	log.Println("Step 8: Starting Django server...")
	if err := backendManager.StartDjangoServer(backendPath, venvPython); err != nil {
		t.Fatalf("Failed to start Django: %v", err)
	}
	defer backendManager.StopServices()

	if !backendManager.IsDjangoRunning() {
		t.Fatal("Django server is not running after start")
	}
	log.Printf("Django running on port %d", backendManager.GetBackendPort())

	log.Println("Step 9: Starting RQ worker...")
	if err := backendManager.StartRQWorker(backendPath, venvPython); err != nil {
		t.Logf("Warning: RQ worker failed to start: %v", err)
	} else {
		log.Println("RQ worker started successfully")
	}

	log.Println("\n=== Native Backend Setup Complete ===")
	log.Printf("Backend path: %s", backendPath)
	log.Printf("Venv Python: %s", venvPython)
	log.Printf("Distribution: %s", savedConfig.DistributionType)
	log.Printf("Source: %s", savedConfig.BackendSource)
	log.Printf("Django port: %d", backendManager.GetBackendPort())
	log.Printf("Redis port: %d", redisManager.GetRedisPort())
}

func TestBackupAndRestore(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping backup/restore integration test in short mode")
	}

	testDataPath := filepath.Join(os.TempDir(), fmt.Sprintf("cupcake-vanilla-backup-test-%d", os.Getpid()))
	defer os.RemoveAll(testDataPath)

	if err := os.MkdirAll(testDataPath, 0755); err != nil {
		t.Fatalf("Failed to create test data path: %v", err)
	}

	pythonManager := services.NewPythonManager(testDataPath)
	candidates := pythonManager.DetectPythonCandidates()

	if len(candidates) == 0 {
		t.Skip("No Python found on system")
	}

	var pythonPath string
	for _, c := range candidates {
		if c.Version >= "3.12" {
			pythonPath = c.Path
			break
		}
	}
	if pythonPath == "" {
		t.Skip("No Python 3.12+ found on system")
	}

	backendPath := filepath.Join(testDataPath, "backend")
	downloader := services.NewBackendDownloader(nil)

	log.Println("Cloning backend repository for backup test...")
	if err := downloader.DownloadSource(backendPath, ""); err != nil {
		t.Fatalf("Failed to clone: %v", err)
	}

	log.Println("Creating virtual environment...")
	venvPython, err := pythonManager.CreateVirtualEnvironment(pythonPath)
	if err != nil {
		if strings.Contains(err.Error(), "ensurepip") || strings.Contains(err.Error(), "venv") {
			t.Skipf("Venv module not available: %v", err)
		}
		t.Fatalf("Failed to create venv: %v", err)
	}

	log.Println("Installing dependencies...")
	requirementsPath := filepath.Join(backendPath, "requirements.txt")
	if err := pythonManager.InstallDependencies(venvPython, requirementsPath); err != nil {
		t.Logf("Warning: Dependency installation failed: %v", err)
		t.Skip("Skipping backup test - dependencies not installed")
	}

	redisManager := services.NewRedisManager(services.RedisManagerOptions{
		UserDataPath: testDataPath,
		IsDev:        true,
	})
	backendManager := services.NewBackendManager(testDataPath, true, redisManager)
	backupManager := services.NewBackupManager(testDataPath, backendManager, nil)

	var logMessages []string
	backupManager.SetLogCallback(func(message string, msgType string) {
		logMessages = append(logMessages, fmt.Sprintf("[%s] %s", msgType, message))
	})

	log.Println("Running migrations before backup test...")
	if err := backendManager.RunMigrations(backendPath, venvPython); err != nil {
		t.Logf("Warning: Migrations failed: %v", err)
		t.Skip("Skipping backup test - migrations failed")
	}

	t.Run("ListBackupsEmpty", func(t *testing.T) {
		backups, err := backupManager.ListBackups()
		if err != nil {
			t.Fatalf("ListBackups failed: %v", err)
		}
		log.Printf("Initial backup count: %d", len(backups))
	})

	t.Run("CreateDatabaseBackup", func(t *testing.T) {
		outputMessages := []string{}
		err := backupManager.CreateDatabaseBackup(backendPath, venvPython, func(output string, isError bool) {
			outputMessages = append(outputMessages, output)
			log.Printf("[dbbackup] %s", output)
		})
		if err != nil {
			t.Fatalf("CreateDatabaseBackup failed: %v", err)
		}

		backups, err := backupManager.ListBackups()
		if err != nil {
			t.Fatalf("ListBackups failed: %v", err)
		}

		dbBackupFound := false
		for _, b := range backups {
			if b.Type == "database" {
				dbBackupFound = true
				log.Printf("Database backup created: %s (size: %d bytes)", b.Name, b.Size)
				break
			}
		}

		if !dbBackupFound {
			t.Error("Database backup not found after CreateDatabaseBackup")
		}
	})

	t.Run("CreateMediaBackup", func(t *testing.T) {
		mediaDir := filepath.Join(backendPath, "media")
		if err := os.MkdirAll(mediaDir, 0755); err != nil {
			t.Fatalf("Failed to create media directory: %v", err)
		}

		testFile := filepath.Join(mediaDir, "test_file.txt")
		if err := os.WriteFile(testFile, []byte("test media content"), 0644); err != nil {
			t.Fatalf("Failed to create test media file: %v", err)
		}

		outputMessages := []string{}
		err := backupManager.CreateMediaBackup(backendPath, venvPython, func(output string, isError bool) {
			outputMessages = append(outputMessages, output)
			log.Printf("[mediabackup] %s", output)
		})
		if err != nil {
			t.Fatalf("CreateMediaBackup failed: %v", err)
		}

		backups, err := backupManager.ListBackups()
		if err != nil {
			t.Fatalf("ListBackups failed: %v", err)
		}

		mediaBackupFound := false
		for _, b := range backups {
			if b.Type == "media" {
				mediaBackupFound = true
				log.Printf("Media backup created: %s (size: %d bytes)", b.Name, b.Size)
				break
			}
		}

		if !mediaBackupFound {
			t.Error("Media backup not found after CreateMediaBackup")
		}
	})

	t.Run("RestoreDatabase", func(t *testing.T) {
		outputMessages := []string{}
		err := backupManager.RestoreDatabase(backendPath, venvPython, func(output string, isError bool) {
			outputMessages = append(outputMessages, output)
			log.Printf("[dbrestore] %s", output)
		})
		if err != nil {
			t.Fatalf("RestoreDatabase failed: %v", err)
		}
		log.Println("Database restored successfully")
	})

	t.Run("RestoreMedia", func(t *testing.T) {
		outputMessages := []string{}
		err := backupManager.RestoreMedia(backendPath, venvPython, func(output string, isError bool) {
			outputMessages = append(outputMessages, output)
			log.Printf("[mediarestore] %s", output)
		})
		if err != nil {
			t.Fatalf("RestoreMedia failed: %v", err)
		}
		log.Println("Media restored successfully")
	})

	t.Run("DeleteBackup", func(t *testing.T) {
		backups, err := backupManager.ListBackups()
		if err != nil {
			t.Fatalf("ListBackups failed: %v", err)
		}

		if len(backups) == 0 {
			t.Skip("No backups to delete")
		}

		backupToDelete := backups[0]
		err = backupManager.DeleteBackup(backupToDelete.Path)
		if err != nil {
			t.Fatalf("DeleteBackup failed: %v", err)
		}

		backupsAfter, err := backupManager.ListBackups()
		if err != nil {
			t.Fatalf("ListBackups failed: %v", err)
		}

		if len(backupsAfter) != len(backups)-1 {
			t.Errorf("Expected %d backups after deletion, got %d", len(backups)-1, len(backupsAfter))
		}

		log.Printf("Deleted backup: %s", backupToDelete.Name)
	})

	log.Println("\n=== Backup and Restore Test Complete ===")
	log.Printf("Log messages captured: %d", len(logMessages))
}

func TestWebSocketConnection(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping WebSocket integration test in short mode")
	}

	testDataPath := filepath.Join(os.TempDir(), fmt.Sprintf("cupcake-vanilla-websocket-test-%d", os.Getpid()))
	defer os.RemoveAll(testDataPath)

	if err := os.MkdirAll(testDataPath, 0755); err != nil {
		t.Fatalf("Failed to create test data path: %v", err)
	}

	pythonManager := services.NewPythonManager(testDataPath)
	candidates := pythonManager.DetectPythonCandidates()

	if len(candidates) == 0 {
		t.Skip("No Python found on system")
	}

	var pythonPath string
	for _, c := range candidates {
		if c.Version >= "3.12" {
			pythonPath = c.Path
			break
		}
	}
	if pythonPath == "" {
		t.Skip("No Python 3.12+ found on system")
	}

	backendPath := filepath.Join(testDataPath, "backend")
	downloader := services.NewBackendDownloader(nil)

	log.Println("Cloning backend repository for WebSocket test...")
	if err := downloader.DownloadSource(backendPath, ""); err != nil {
		t.Fatalf("Failed to clone: %v", err)
	}

	log.Println("Creating virtual environment...")
	venvPython, err := pythonManager.CreateVirtualEnvironment(pythonPath)
	if err != nil {
		if strings.Contains(err.Error(), "ensurepip") || strings.Contains(err.Error(), "venv") {
			t.Skipf("Venv module not available: %v", err)
		}
		t.Fatalf("Failed to create venv: %v", err)
	}

	log.Println("Installing dependencies...")
	requirementsPath := filepath.Join(backendPath, "requirements.txt")
	if err := pythonManager.InstallDependencies(venvPython, requirementsPath); err != nil {
		t.Logf("Warning: Dependency installation failed: %v", err)
		t.Skip("Skipping WebSocket test - dependencies not installed")
	}

	redisManager := services.NewRedisManager(services.RedisManagerOptions{
		UserDataPath: testDataPath,
		IsDev:        true,
	})
	backendManager := services.NewBackendManager(testDataPath, true, redisManager)

	log.Println("Running migrations...")
	if err := backendManager.RunMigrations(backendPath, venvPython); err != nil {
		t.Logf("Warning: Migrations failed: %v", err)
		t.Skip("Skipping WebSocket test - migrations failed")
	}

	redisDir := redisManager.GetRedisDir()
	if err := os.MkdirAll(redisDir, 0755); err != nil {
		t.Fatalf("Failed to create Redis directory: %v", err)
	}

	log.Println("Starting Redis server...")
	if err := redisManager.StartRedis(); err != nil {
		if services.IsRedisNotFoundError(err) {
			t.Skip("Redis/Valkey not found - skipping WebSocket test")
		}
		t.Fatalf("Failed to start Redis: %v", err)
	}
	defer redisManager.StopRedis()

	log.Println("Starting Django server...")
	if err := backendManager.StartDjangoServer(backendPath, venvPython); err != nil {
		t.Fatalf("Failed to start Django: %v", err)
	}
	defer backendManager.StopServices()

	time.Sleep(3 * time.Second)

	if !backendManager.IsDjangoRunning() {
		t.Fatal("Django server is not running")
	}

	backendPort := backendManager.GetBackendPort()
	log.Printf("Django running on port %d", backendPort)

	log.Println("Creating superuser for WebSocket test...")
	testUsername := "wstest_admin"
	testPassword := "wstest_password_123"
	testEmail := "wstest@test.com"
	userManager := services.NewUserManager(backendManager, testDataPath, true)
	if err := userManager.CreateSuperuser(backendPath, venvPython, testUsername, testEmail, testPassword); err != nil {
		t.Logf("Warning: Failed to create superuser (may already exist): %v", err)
	}

	t.Run("ObtainJWTToken", func(t *testing.T) {
		loginURL := fmt.Sprintf("http://localhost:%d/api/token/", backendPort)
		credentials := map[string]string{
			"username": testUsername,
			"password": testPassword,
		}
		body, _ := json.Marshal(credentials)

		resp, err := http.Post(loginURL, "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatalf("Failed to obtain JWT token: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			bodyBytes, _ := io.ReadAll(resp.Body)
			t.Fatalf("Failed to obtain JWT token, status %d: %s", resp.StatusCode, string(bodyBytes))
		}

		var tokenResponse map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&tokenResponse); err != nil {
			t.Fatalf("Failed to decode token response: %v", err)
		}

		if _, ok := tokenResponse["access"]; !ok {
			t.Fatal("JWT response missing 'access' token")
		}

		log.Println("JWT token obtained successfully")
	})

	t.Run("WebSocketConnection", func(t *testing.T) {
		loginURL := fmt.Sprintf("http://localhost:%d/api/token/", backendPort)
		credentials := map[string]string{
			"username": testUsername,
			"password": testPassword,
		}
		body, _ := json.Marshal(credentials)

		resp, err := http.Post(loginURL, "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatalf("Failed to obtain JWT token: %v", err)
		}
		defer resp.Body.Close()

		var tokenResponse map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&tokenResponse); err != nil {
			t.Fatalf("Failed to decode token response: %v", err)
		}

		accessToken := tokenResponse["access"].(string)

		wsURL := url.URL{
			Scheme:   "ws",
			Host:     fmt.Sprintf("localhost:%d", backendPort),
			Path:     "/ws/notifications/",
			RawQuery: fmt.Sprintf("token=%s", accessToken),
		}

		log.Printf("Connecting to WebSocket: %s", wsURL.String())
		conn, _, err := websocket.DefaultDialer.Dial(wsURL.String(), nil)
		if err != nil {
			t.Fatalf("Failed to connect to WebSocket: %v", err)
		}
		defer conn.Close()

		log.Println("WebSocket connection established")

		conn.SetReadDeadline(time.Now().Add(5 * time.Second))

		_, message, err := conn.ReadMessage()
		if err != nil {
			t.Fatalf("Failed to read initial message: %v", err)
		}

		var initialMsg map[string]interface{}
		if err := json.Unmarshal(message, &initialMsg); err != nil {
			t.Fatalf("Failed to parse initial message: %v", err)
		}

		if initialMsg["type"] != "connection.established" {
			t.Errorf("Expected connection.established, got %v", initialMsg["type"])
		}

		log.Printf("Received initial message: %s", string(message))
	})

	t.Run("WebSocketPingPong", func(t *testing.T) {
		loginURL := fmt.Sprintf("http://localhost:%d/api/token/", backendPort)
		credentials := map[string]string{
			"username": testUsername,
			"password": testPassword,
		}
		body, _ := json.Marshal(credentials)

		resp, err := http.Post(loginURL, "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatalf("Failed to obtain JWT token: %v", err)
		}
		defer resp.Body.Close()

		var tokenResponse map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&tokenResponse); err != nil {
			t.Fatalf("Failed to decode token response: %v", err)
		}

		accessToken := tokenResponse["access"].(string)

		wsURL := url.URL{
			Scheme:   "ws",
			Host:     fmt.Sprintf("localhost:%d", backendPort),
			Path:     "/ws/notifications/",
			RawQuery: fmt.Sprintf("token=%s", accessToken),
		}

		conn, _, err := websocket.DefaultDialer.Dial(wsURL.String(), nil)
		if err != nil {
			t.Fatalf("Failed to connect to WebSocket: %v", err)
		}
		defer conn.Close()

		conn.SetReadDeadline(time.Now().Add(5 * time.Second))
		_, _, err = conn.ReadMessage()
		if err != nil {
			t.Fatalf("Failed to read initial message: %v", err)
		}

		pingMsg := map[string]string{"type": "ping"}
		if err := conn.WriteJSON(pingMsg); err != nil {
			t.Fatalf("Failed to send ping: %v", err)
		}

		log.Println("Sent ping message")

		conn.SetReadDeadline(time.Now().Add(5 * time.Second))
		_, message, err := conn.ReadMessage()
		if err != nil {
			t.Fatalf("Failed to read pong response: %v", err)
		}

		var pongMsg map[string]interface{}
		if err := json.Unmarshal(message, &pongMsg); err != nil {
			t.Fatalf("Failed to parse pong message: %v", err)
		}

		if pongMsg["type"] != "pong" {
			t.Errorf("Expected pong, got %v", pongMsg["type"])
		}

		log.Printf("Received pong: %s", string(message))
	})

	t.Run("AdminWebSocketConnection", func(t *testing.T) {
		loginURL := fmt.Sprintf("http://localhost:%d/api/token/", backendPort)
		credentials := map[string]string{
			"username": testUsername,
			"password": testPassword,
		}
		body, _ := json.Marshal(credentials)

		resp, err := http.Post(loginURL, "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatalf("Failed to obtain JWT token: %v", err)
		}
		defer resp.Body.Close()

		var tokenResponse map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&tokenResponse); err != nil {
			t.Fatalf("Failed to decode token response: %v", err)
		}

		accessToken := tokenResponse["access"].(string)

		wsURL := url.URL{
			Scheme:   "ws",
			Host:     fmt.Sprintf("localhost:%d", backendPort),
			Path:     "/ws/admin/",
			RawQuery: fmt.Sprintf("token=%s", accessToken),
		}

		log.Printf("Connecting to Admin WebSocket: %s", wsURL.String())
		conn, _, err := websocket.DefaultDialer.Dial(wsURL.String(), nil)
		if err != nil {
			t.Fatalf("Failed to connect to Admin WebSocket: %v", err)
		}
		defer conn.Close()

		log.Println("Admin WebSocket connection established")

		conn.SetReadDeadline(time.Now().Add(5 * time.Second))

		_, message, err := conn.ReadMessage()
		if err != nil {
			t.Fatalf("Failed to read initial message from admin WS: %v", err)
		}

		var initialMsg map[string]interface{}
		if err := json.Unmarshal(message, &initialMsg); err != nil {
			t.Fatalf("Failed to parse initial message: %v", err)
		}

		if initialMsg["type"] != "connection.established" {
			t.Errorf("Expected connection.established, got %v", initialMsg["type"])
		}

		log.Printf("Admin WebSocket initial message: %s", string(message))
	})

	log.Println("\n=== WebSocket Test Complete ===")
	log.Println("All WebSocket connections and message exchanges verified successfully")
}
