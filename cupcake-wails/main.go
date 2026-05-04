package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist/browser
var setupAssets embed.FS

//go:embed all:mainapp/dist/browser
var mainAppAssets embed.FS

//go:embed resources/icon.ico
var iconICO []byte

//go:embed resources/cupcake_logo.png
var iconPNG []byte

func getSetupAssets() fs.FS {
	subFS, err := fs.Sub(setupAssets, "frontend/dist/browser")
	if err != nil {
		log.Printf("WARNING: Failed to get setup assets: %v\n", err)
		return setupAssets
	}
	return subFS
}

func getMainAppAssets() fs.FS {
	subFS, err := fs.Sub(mainAppAssets, "mainapp/dist/browser")
	if err != nil {
		log.Printf("WARNING: Failed to get main app assets: %v\n", err)
		return mainAppAssets
	}
	return subFS
}

func getMimeType(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	mimeTypes := map[string]string{
		".html": "text/html; charset=utf-8",
		".css":  "text/css; charset=utf-8",
		".js":   "application/javascript; charset=utf-8",
		".mjs":  "application/javascript; charset=utf-8",
		".json": "application/json; charset=utf-8",
		".png":  "image/png",
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".gif":  "image/gif",
		".svg":  "image/svg+xml",
		".ico":  "image/x-icon",
		".woff": "font/woff",
		".woff2": "font/woff2",
		".ttf":  "font/ttf",
		".eot":  "application/vnd.ms-fontobject",
		".map":  "application/json",
	}
	if mime, ok := mimeTypes[ext]; ok {
		return mime
	}
	return "application/octet-stream"
}

func newDualSPAHandler(setupFS fs.FS, mainAppFS fs.FS) http.Handler {
	setupRoutes := map[string]bool{
		"/splash":              true,
		"/python-selection":    true,
		"/backend-download":    true,
		"/valkey-download":     true,
		"/backend-setup":       true,
		"/management":          true,
		"/debug":               true,
		"/downloader":          true,
		"/superuser-creation":  true,
		"/password-reset":      true,
	}

	isStaticAsset := func(path string) bool {
		ext := strings.ToLower(filepath.Ext(path))
		staticExts := []string{".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".eot", ".map", ".json"}
		for _, e := range staticExts {
			if ext == e {
				return true
			}
		}
		return false
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		urlPath := r.URL.Path

		isSetupRoute := false
		for route := range setupRoutes {
			if strings.HasPrefix(urlPath, route) {
				isSetupRoute = true
				break
			}
		}

		if strings.HasPrefix(urlPath, "/setup/") {
			urlPath = strings.TrimPrefix(urlPath, "/setup")
			isSetupRoute = true
		}

		path := strings.TrimPrefix(urlPath, "/")
		if path == "" {
			path = "index.html"
		}

		isStatic := isStaticAsset(path)

		if isStatic {
			var primaryFS, fallbackFS fs.FS
			if isSetupRoute {
				primaryFS = setupFS
				fallbackFS = mainAppFS
			} else {
				primaryFS = mainAppFS
				fallbackFS = setupFS
			}

			content, err := fs.ReadFile(primaryFS, path)
			if err == nil {
				w.Header().Set("Content-Type", getMimeType(path))
				w.WriteHeader(http.StatusOK)
				w.Write(content)
				return
			}

			content, err = fs.ReadFile(fallbackFS, path)
			if err == nil {
				w.Header().Set("Content-Type", getMimeType(path))
				w.WriteHeader(http.StatusOK)
				w.Write(content)
				return
			}

			log.Printf("[AssetHandler] Static file not found: %s", path)
			http.NotFound(w, r)
			return
		}

		var fsys fs.FS
		if isSetupRoute {
			fsys = setupFS
		} else {
			fsys = mainAppFS
		}

		content, err := fs.ReadFile(fsys, path)
		if err == nil {
			w.Header().Set("Content-Type", getMimeType(path))
			w.WriteHeader(http.StatusOK)
			w.Write(content)
			return
		}

		indexContent, err := fs.ReadFile(fsys, "index.html")
		if err != nil {
			http.Error(w, "index.html not found", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		w.Write(indexContent)
	})
}

func setupLogRotation(logDir string) (*os.File, error) {
	os.MkdirAll(logDir, 0755)

	today := time.Now().Format("2006-01-02")
	logFileName := fmt.Sprintf("cupcake-%s.log", today)
	logFilePath := filepath.Join(logDir, logFileName)

	logFile, err := os.OpenFile(
		logFilePath,
		os.O_CREATE|os.O_WRONLY|os.O_APPEND,
		0666,
	)
	if err != nil {
		return nil, err
	}

	cleanOldLogs(logDir, 7)

	return logFile, nil
}

func cleanOldLogs(logDir string, maxFiles int) {
	files, err := os.ReadDir(logDir)
	if err != nil {
		return
	}

	var logFiles []string
	for _, file := range files {
		if !file.IsDir() && strings.HasPrefix(file.Name(), "cupcake-") && strings.HasSuffix(file.Name(), ".log") {
			logFiles = append(logFiles, file.Name())
		}
	}

	if len(logFiles) <= maxFiles {
		return
	}

	sort.Strings(logFiles)

	filesToDelete := len(logFiles) - maxFiles
	for i := 0; i < filesToDelete; i++ {
		os.Remove(filepath.Join(logDir, logFiles[i]))
	}
}

func createApplicationMenu(app *App) *application.Menu {
	menu := application.NewMenu()

	managementMenu := menu.AddSubmenu("Management")
	managementMenu.Add("Database Setup").OnClick(func(ctx *application.Context) {
		app.OpenManagementPanel()
	})
	managementMenu.Add("Backend Setup").OnClick(func(ctx *application.Context) {
		app.OpenBackendSetupPanel()
	})
	managementMenu.Add("Reset Password").OnClick(func(ctx *application.Context) {
		app.OpenPasswordResetPanel()
	})
	managementMenu.AddSeparator()
	managementMenu.Add("Open User Data Folder").OnClick(func(ctx *application.Context) {
		app.OpenUserDataFolder()
	})
	managementMenu.Add("Open Log File").OnClick(func(ctx *application.Context) {
		app.OpenLogFile()
	})
	managementMenu.AddSeparator()
	managementMenu.Add("Debug Panel").OnClick(func(ctx *application.Context) {
		app.OpenDebugPanel()
	})

	helpMenu := menu.AddSubmenu("Help")
	helpMenu.Add("About Cupcake").OnClick(func(ctx *application.Context) {
		app.ShowAboutDialog()
	})

	return menu
}

func main() {
	userConfigDir, err := os.UserConfigDir()
	if err != nil {
		userConfigDir = "."
	}
	logDir := filepath.Join(userConfigDir, "cupcake")

	logFile, err := setupLogRotation(logDir)
	var logFilePath string
	if err == nil {
		log.SetOutput(logFile)
		defer logFile.Close()
		logFilePath = logFile.Name()
	}

	log.Println("========================================")
	log.Println("Cupcake Wails starting...")
	log.Printf("Log directory: %s\n", logDir)
	fmt.Println("Cupcake starting - logs at:", logDir)

	app := NewApp()
	if logFilePath != "" {
		app.SetLogFilePath(logFilePath)
		log.Printf("Log file path set to: %s\n", logFilePath)
	}

	log.Println("Creating Wails application...")

	wailsApp := application.New(application.Options{
		Name:        "Cupcake",
		Description: "Metadata management for mass spectrometry",
		Icon:        iconPNG,
		Services: []application.Service{
			application.NewService(app),
		},
		Assets: application.AssetOptions{
			Handler: newDualSPAHandler(getSetupAssets(), getMainAppAssets()),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
		OnShutdown: func() {
			app.Shutdown()
		},
	})

	app.SetApplication(wailsApp)

	appMenu := createApplicationMenu(app)
	app.SetAppMenu(appMenu)
	wailsApp.Menu.SetApplicationMenu(appMenu)

	testAPI := NewTestAPI(app)
	testAPI.Start(9999)

	splashWindow := wailsApp.Window.New()
	splashWindow.SetTitle("Cupcake - Starting...")
	splashWindow.SetSize(600, 500)
	splashWindow.SetResizable(false)
	splashWindow.SetURL("/setup/#/splash")

	app.SetSplashWindow(splashWindow)

	log.Println("Showing splash window...")
	splashWindow.Show()

	go func() {
		time.Sleep(2 * time.Second)
		log.Println("Opening DevTools...")
		splashWindow.OpenDevTools()
	}()

	go app.InitializeBackend()

	err = wailsApp.Run()
	if err != nil {
		log.Printf("ERROR: Wails.Run failed: %v\n", err)
		fmt.Println("Error:", err.Error())
	}

	log.Println("Cupcake exiting")
}
