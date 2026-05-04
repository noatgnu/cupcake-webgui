package main

import (
	"io/fs"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

func TestDualSPAHandler_SetupRoutes(t *testing.T) {
	setupFS := fstest.MapFS{
		"index.html": {Data: []byte("<html>setup</html>")},
		"main.js":    {Data: []byte("setup.js")},
	}

	mainAppFS := fstest.MapFS{
		"index.html": {Data: []byte("<html>mainapp</html>")},
		"main.js":    {Data: []byte("mainapp.js")},
	}

	handler := newDualSPAHandler(setupFS, mainAppFS)

	setupRoutes := []string{
		"/splash",
		"/python-selection",
		"/backend-download",
		"/valkey-download",
		"/backend-setup",
		"/management",
		"/debug",
	}

	for _, route := range setupRoutes {
		t.Run("setup_"+route, func(t *testing.T) {
			req := httptest.NewRequest("GET", route, nil)
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			if rec.Code != http.StatusOK {
				t.Errorf("Route %s: expected status 200, got %d", route, rec.Code)
			}

			body := rec.Body.String()
			if !strings.Contains(body, "<html>setup</html>") {
				t.Errorf("Route %s: expected setup index.html, got %q", route, body)
			}
		})
	}
}

func TestDualSPAHandler_MainAppRoutes(t *testing.T) {
	setupFS := fstest.MapFS{
		"index.html": {Data: []byte("<html>setup</html>")},
	}

	mainAppFS := fstest.MapFS{
		"index.html": {Data: []byte("<html>mainapp</html>")},
		"main.js":    {Data: []byte("mainapp.js")},
	}

	handler := newDualSPAHandler(setupFS, mainAppFS)

	mainAppRoutes := []string{
		"/",
		"/metadata-tables",
		"/settings",
		"/projects",
		"/some/nested/route",
	}

	for _, route := range mainAppRoutes {
		t.Run("mainapp_"+route, func(t *testing.T) {
			req := httptest.NewRequest("GET", route, nil)
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			if rec.Code != http.StatusOK {
				t.Errorf("Route %s: expected status 200, got %d", route, rec.Code)
			}

			body := rec.Body.String()
			if !strings.Contains(body, "<html>mainapp</html>") {
				t.Errorf("Route %s: expected mainapp index.html, got %q", route, body)
			}
		})
	}
}

func TestDualSPAHandler_SetupPrefixRouting(t *testing.T) {
	setupFS := fstest.MapFS{
		"index.html": {Data: []byte("<html>setup</html>")},
		"main.js":    {Data: []byte("setup.js")},
	}

	mainAppFS := fstest.MapFS{
		"index.html": {Data: []byte("<html>mainapp</html>")},
	}

	handler := newDualSPAHandler(setupFS, mainAppFS)

	req := httptest.NewRequest("GET", "/setup/main.js", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rec.Code)
	}

	body := rec.Body.String()
	if !strings.Contains(body, "setup.js") {
		t.Errorf("Expected setup main.js content, got %q", body)
	}
}

func TestDualSPAHandler_StaticAssets(t *testing.T) {
	setupFS := fstest.MapFS{
		"index.html": {Data: []byte("<html>setup</html>")},
		"styles.css": {Data: []byte("setup {}"),
			Mode: 0644,
		},
	}

	mainAppFS := fstest.MapFS{
		"index.html": {Data: []byte("<html>mainapp</html>")},
		"styles.css": {Data: []byte("mainapp {}"),
			Mode: 0644,
		},
	}

	handler := newDualSPAHandler(setupFS, mainAppFS)

	req := httptest.NewRequest("GET", "/styles.css", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rec.Code)
	}

	body := rec.Body.String()
	if !strings.Contains(body, "mainapp {}") {
		t.Errorf("Expected mainapp styles.css, got %q", body)
	}
}

func TestDualSPAHandler_ContentTypes(t *testing.T) {
	setupFS := fstest.MapFS{
		"index.html": {Data: []byte("<html>setup</html>")},
	}

	mainAppFS := fstest.MapFS{
		"index.html": {Data: []byte("<html>mainapp</html>")},
	}

	handler := newDualSPAHandler(setupFS, mainAppFS)

	tests := []struct {
		path        string
		contentType string
	}{
		{"/splash", "text/html"},
		{"/", "text/html"},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			req := httptest.NewRequest("GET", tt.path, nil)
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			ct := rec.Header().Get("Content-Type")
			if !strings.Contains(ct, tt.contentType) {
				t.Errorf("Path %s: expected Content-Type to contain %q, got %q", tt.path, tt.contentType, ct)
			}
		})
	}
}

func TestGetSetupAssets_ReturnsSubFS(t *testing.T) {
	subFS := getSetupAssets()
	if subFS == nil {
		t.Fatal("getSetupAssets() returned nil")
	}

	_, err := fs.Stat(subFS, "index.html")
	if err != nil {
		t.Errorf("Expected index.html to exist in setup filesystem: %v", err)
	}
}

func TestGetMainAppAssets_ReturnsSubFS(t *testing.T) {
	subFS := getMainAppAssets()
	if subFS == nil {
		t.Fatal("getMainAppAssets() returned nil")
	}

	_, err := fs.Stat(subFS, "index.html")
	if err != nil {
		t.Errorf("Expected index.html to exist in mainapp filesystem: %v", err)
	}
}
