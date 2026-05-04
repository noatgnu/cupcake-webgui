package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/noatgnu/cupcake-webgui/cupcake-wails/backend/models"
)

type TestAPI struct {
	app *App
}

func NewTestAPI(app *App) *TestAPI {
	return &TestAPI{app: app}
}

func (t *TestAPI) Start(port int) {
	if os.Getenv("CUPCAKE_TEST_MODE") != "true" {
		return
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/test/health", t.handleHealth)
	mux.HandleFunc("/test/python-candidates", t.handlePythonCandidates)
	mux.HandleFunc("/test/select-python", t.handleSelectPython)
	mux.HandleFunc("/test/setup-native", t.handleSetupNative)
	mux.HandleFunc("/test/download-portable", t.handleDownloadPortable)
	mux.HandleFunc("/test/download-valkey", t.handleDownloadValkey)
	mux.HandleFunc("/test/backend-ready", t.handleBackendReady)
	mux.HandleFunc("/test/distribution-info", t.handleDistributionInfo)
	mux.HandleFunc("/test/available-releases", t.handleAvailableReleases)
	mux.HandleFunc("/test/create-superuser", t.handleCreateSuperuser)

	mux.HandleFunc("/test/windows", t.handleGetWindows)
	mux.HandleFunc("/test/ui/open-python-selection", t.handleOpenPythonSelection)
	mux.HandleFunc("/test/ui/open-downloader", t.handleOpenDownloader)
	mux.HandleFunc("/test/ui/open-superuser", t.handleOpenSuperuser)
	mux.HandleFunc("/test/ui/python-selection/select", t.handleUIPythonSelect)
	mux.HandleFunc("/test/ui/downloader/select-version", t.handleUIDownloaderSelectVersion)
	mux.HandleFunc("/test/ui/downloader/start", t.handleUIDownloaderStart)
	mux.HandleFunc("/test/ui/downloader/start-download", t.handleUIDownloaderStartDownload)
	mux.HandleFunc("/test/ui/superuser/fill", t.handleUISuperuserFill)
	mux.HandleFunc("/test/ui/superuser/submit", t.handleUISuperuserSubmit)
	mux.HandleFunc("/test/ui/downloader/progress", t.handleUIDownloaderProgress)
	mux.HandleFunc("/test/ui/downloader/status", t.handleUIDownloaderStatus)
	mux.HandleFunc("/test/ui/downloader/ready", t.handleUIDownloaderReady)
	mux.HandleFunc("/test/ui/downloader/diagnose", t.handleUIDownloaderDiagnose)
	mux.HandleFunc("/test/ui/downloader/set-mode", t.handleUIDownloaderSetMode)
	mux.HandleFunc("/test/ui/downloader/start-native", t.handleUIDownloaderStartNative)
	mux.HandleFunc("/test/ui/open-valkey-downloader", t.handleOpenValkeyDownloader)
	mux.HandleFunc("/test/ui/python-selection/set-custom-path", t.handleUIPythonSetCustomPath)
	mux.HandleFunc("/test/ui/python-selection/toggle-venv", t.handleUIPythonToggleVenv)
	mux.HandleFunc("/test/ui/python-selection/submit", t.handleUIPythonSubmit)
	mux.HandleFunc("/test/ui/python-selection/candidates", t.handleUIPythonCandidates)
	mux.HandleFunc("/test/ui/superuser/skip", t.handleUISuperuserSkip)
	mux.HandleFunc("/test/ui/superuser/diagnose", t.handleUISuperuserDiagnose)
	mux.HandleFunc("/test/reset-config", t.handleResetConfig)
	mux.HandleFunc("/test/delete-backend", t.handleDeleteBackend)
	mux.HandleFunc("/test/user-count", t.handleUserCount)

	mux.HandleFunc("/test/management/sync-schemas", t.handleSyncSchemas)
	mux.HandleFunc("/test/management/load-column-templates", t.handleLoadColumnTemplates)
	mux.HandleFunc("/test/management/load-ontologies", t.handleLoadOntologies)
	mux.HandleFunc("/test/management/schema-count", t.handleSchemaCount)
	mux.HandleFunc("/test/management/column-template-count", t.handleColumnTemplateCount)
	mux.HandleFunc("/test/management/ontology-counts", t.handleOntologyCounts)
	mux.HandleFunc("/test/ui/open-management", t.handleOpenManagement)
	mux.HandleFunc("/test/ui/management/click-command", t.handleUIManagementClickCommand)
	mux.HandleFunc("/test/ui/management/get-stats", t.handleUIManagementGetStats)
	mux.HandleFunc("/test/ui/management/command-status", t.handleUIManagementGetCommandStatus)
	mux.HandleFunc("/test/ui/management/wait-for-command", t.handleUIManagementWaitForCommand)

	mux.HandleFunc("/test/backup/create-database", t.handleBackupCreateDatabase)
	mux.HandleFunc("/test/backup/create-media", t.handleBackupCreateMedia)
	mux.HandleFunc("/test/backup/create-full", t.handleBackupCreateFull)
	mux.HandleFunc("/test/backup/restore-database", t.handleBackupRestoreDatabase)
	mux.HandleFunc("/test/backup/restore-media", t.handleBackupRestoreMedia)
	mux.HandleFunc("/test/backup/list", t.handleBackupList)
	mux.HandleFunc("/test/backup/delete", t.handleBackupDelete)
	mux.HandleFunc("/test/backup/import-initial-database", t.handleBackupImportInitialDatabase)
	mux.HandleFunc("/test/backup/seed-initial-database", t.handleBackupSeedInitialDatabase)

	addr := fmt.Sprintf("127.0.0.1:%d", port)
	log.Printf("[TestAPI] Starting test API server on %s", addr)

	go func() {
		if err := http.ListenAndServe(addr, mux); err != nil {
			log.Printf("[TestAPI] Server error: %v", err)
		}
	}()
}

func (t *TestAPI) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":       "ok",
		"backendReady": t.app.IsBackendReady(),
	})
}

func (t *TestAPI) handlePythonCandidates(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	candidates := t.app.DetectPythonCandidates()
	json.NewEncoder(w).Encode(candidates)
}

func (t *TestAPI) handleSelectPython(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Path       string `json:"path"`
		CreateVenv bool   `json:"createVenv"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	t.app.SelectPython(req.Path, req.CreateVenv)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "started"})
}

func (t *TestAPI) handleSetupNative(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		PythonPath string `json:"pythonPath"`
		Branch     string `json:"branch"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Branch == "" {
		req.Branch = "master"
	}

	go func() {
		if err := t.app.SetupNativeBackend(req.PythonPath, req.Branch); err != nil {
			log.Printf("[TestAPI] Setup native error: %v", err)
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "started"})
}

func (t *TestAPI) handleDownloadPortable(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Version string `json:"version"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	go func() {
		if err := t.app.DownloadPortableBackend(req.Version); err != nil {
			log.Printf("[TestAPI] Download portable error: %v", err)
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "started"})
}

func (t *TestAPI) handleDownloadValkey(w http.ResponseWriter, r *http.Request) {
	log.Printf("[TestAPI] handleDownloadValkey called with method: %s", r.Method)

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	log.Printf("[TestAPI] Starting Valkey download...")
	err := t.app.DownloadValkey()
	log.Printf("[TestAPI] Valkey download finished, err: %v", err)

	w.Header().Set("Content-Type", "application/json")
	if err != nil {
		log.Printf("[TestAPI] Download valkey error: %v", err)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":    "error",
			"error":     err.Error(),
			"completed": false,
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "completed",
		"completed": true,
	})
}

func (t *TestAPI) handleBackendReady(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"ready": t.app.IsBackendReady()})
}

func (t *TestAPI) handleDistributionInfo(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	info := t.app.GetDistributionInfo()
	json.NewEncoder(w).Encode(info)
}

func (t *TestAPI) handleAvailableReleases(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	releases, err := t.app.GetAvailableReleases()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(releases)
}

func (t *TestAPI) handleCreateSuperuser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	log.Printf("[TestAPI] Creating superuser: username=%s, email=%s", req.Username, req.Email)
	log.Printf("[TestAPI] App venvPath: %s", t.app.venvPath)
	log.Printf("[TestAPI] App backendReady: %v", t.app.backendReady)

	err := t.app.CreateSuperuser(req.Username, req.Email, req.Password)
	w.Header().Set("Content-Type", "application/json")
	if err != nil {
		log.Printf("[TestAPI] CreateSuperuser error: %v", err)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":  false,
			"error":    err.Error(),
			"venvPath": t.app.venvPath,
		})
		return
	}
	log.Printf("[TestAPI] CreateSuperuser success")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"venvPath": t.app.venvPath,
	})
}

func (t *TestAPI) handleGetWindows(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	windows := map[string]bool{
		"splash":          t.app.splashWindow != nil,
		"main":            t.app.mainWindow != nil,
		"pythonSelection": t.app.pythonSelectionWindow != nil,
		"downloader":      t.app.downloaderWindow != nil,
		"superuser":       t.app.superuserWindow != nil,
		"management":      t.app.managementWindow != nil,
		"debug":           t.app.debugWindow != nil,
	}
	json.NewEncoder(w).Encode(windows)
}

func (t *TestAPI) handleOpenPythonSelection(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	t.app.showPythonSelectionDialog()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"opened": true})
}

func (t *TestAPI) handleOpenDownloader(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	t.app.showBackendDownloadDialog()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"opened": true})
}

func (t *TestAPI) handleOpenSuperuser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	t.app.showSuperuserCreationModal()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"opened": true})
}

func (t *TestAPI) handleUIPythonSelect(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Index int `json:"index"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if t.app.pythonSelectionWindow == nil {
		http.Error(w, "Python selection window not open", http.StatusBadRequest)
		return
	}

	js := fmt.Sprintf(`
		(function() {
			const items = document.querySelectorAll('.candidate-card, .python-item, .candidate-item');
			if (items.length > %d) {
				items[%d].click();
				return true;
			}
			return false;
		})()
	`, req.Index, req.Index)

	t.app.pythonSelectionWindow.ExecJS(js)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"clicked": true})
}

func (t *TestAPI) handleUIDownloaderSelectVersion(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Index int `json:"index"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if t.app.downloaderWindow == nil {
		http.Error(w, "Downloader window not open", http.StatusBadRequest)
		return
	}

	js := fmt.Sprintf(`
		(function() {
			const items = document.querySelectorAll('.selection-item, .release-item');
			if (items.length > %d) {
				items[%d].click();
				return true;
			}
			return false;
		})()
	`, req.Index, req.Index)

	t.app.downloaderWindow.ExecJS(js)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"selected": true})
}

func (t *TestAPI) handleUIDownloaderStart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if t.app.downloaderWindow == nil {
		http.Error(w, "Downloader window not open", http.StatusBadRequest)
		return
	}

	js := `
		(function() {
			const btn = document.querySelector('.cupcake-btn.primary, .btn-primary, button.primary');
			if (btn && !btn.disabled) {
				const event = new MouseEvent('click', {
					bubbles: true,
					cancelable: true,
					view: window
				});
				btn.dispatchEvent(event);
				console.log('[TestAPI] Download button clicked via dispatchEvent');
				return true;
			}
			console.log('[TestAPI] Download button not found or disabled');
			return false;
		})()
	`

	t.app.downloaderWindow.ExecJS(js)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"started": true})
}

func (t *TestAPI) handleUIDownloaderStartDownload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Version string `json:"version"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Version == "" {
		releases, err := t.app.GetAvailableReleases()
		if err != nil || len(releases) == 0 {
			http.Error(w, "No releases available", http.StatusInternalServerError)
			return
		}
		req.Version = releases[0].Tag
	}

	go func() {
		log.Printf("[TestAPI] Starting download for version: %s", req.Version)
		if err := t.app.DownloadPortableBackend(req.Version); err != nil {
			log.Printf("[TestAPI] Download error: %v", err)
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"started": true,
		"version": req.Version,
	})
}

func (t *TestAPI) handleUISuperuserFill(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Username        string `json:"username"`
		Email           string `json:"email"`
		Password        string `json:"password"`
		ConfirmPassword string `json:"confirmPassword"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if t.app.superuserWindow == nil {
		http.Error(w, "Superuser window not open", http.StatusBadRequest)
		return
	}

	js := fmt.Sprintf(`
		(function() {
			function setAngularInputValue(selector, value) {
				const input = document.querySelector(selector);
				if (!input) {
					console.log('[TestAPI] Input not found:', selector);
					return false;
				}

				input.focus();

				const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
					window.HTMLInputElement.prototype, 'value'
				).set;
				nativeInputValueSetter.call(input, value);

				input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));

				const ngModelCtrl = input['ngModel'] || input['_ngModelCtrl'];
				if (ngModelCtrl && typeof ngModelCtrl.viewToModelUpdate === 'function') {
					ngModelCtrl.viewToModelUpdate(value);
				}

				const ngContext = input.__ngContext__;
				if (ngContext) {
					console.log('[TestAPI] Angular context found, triggering change detection');
				}

				console.log('[TestAPI] Set', selector, 'to:', input.value);
				return true;
			}

			setAngularInputValue('#username', %q);
			setAngularInputValue('#email', %q);
			setAngularInputValue('#password', %q);
			setAngularInputValue('#confirmPassword', %q);

			setTimeout(() => {
				const btn = document.querySelector('.btn-primary');
				if (btn) {
					console.log('[TestAPI] Submit button disabled:', btn.disabled);
				}
			}, 100);

			return true;
		})()
	`, req.Username, req.Email, req.Password, req.ConfirmPassword)

	t.app.superuserWindow.ExecJS(js)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"filled": true})
}

func (t *TestAPI) handleUISuperuserSubmit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if t.app.superuserWindow == nil {
		http.Error(w, "Superuser window not open", http.StatusBadRequest)
		return
	}

	js := `
		(function() {
			const btn = document.querySelector('.cupcake-btn.primary, .btn-primary, button[type="submit"]');
			if (btn && !btn.disabled) {
				btn.click();
				return true;
			}
			return false;
		})()
	`

	t.app.superuserWindow.ExecJS(js)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"submitted": true})
}

func (t *TestAPI) handleUIDownloaderProgress(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	progress := t.app.GetDownloadProgress()
	json.NewEncoder(w).Encode(progress)
}

func (t *TestAPI) handleUIDownloaderStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	status := map[string]interface{}{
		"windowOpen":   t.app.downloaderWindow != nil,
		"backendReady": t.app.IsBackendReady(),
		"downloading":  t.app.IsDownloading(),
	}
	json.NewEncoder(w).Encode(status)
}

func (t *TestAPI) handleUIDownloaderReady(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if t.app.downloaderWindow == nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"ready": false,
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"ready": true,
	})
}

func (t *TestAPI) handleUIDownloaderDiagnose(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if t.app.downloaderWindow == nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"windowOpen": false,
		})
		return
	}

	js := `
		(function() {
			const releaseItems = document.querySelectorAll('.selection-item, .release-item');
			const selectedItem = document.querySelector('.selection-item.active, .release-item.selected');
			const loadingEl = document.querySelector('.loading-state-small, .loading-releases');
			const downloadBtn = document.querySelector('.cupcake-btn.primary, .btn-primary, button.primary');
			const errorEl = document.querySelector('.error-message');

			console.log('[Diagnose] Release items:', releaseItems.length);
			console.log('[Diagnose] Selected item:', selectedItem);
			console.log('[Diagnose] Loading:', loadingEl);
			console.log('[Diagnose] Download button:', downloadBtn);
			console.log('[Diagnose] Button disabled:', downloadBtn ? downloadBtn.disabled : 'N/A');

			return JSON.stringify({
				releaseCount: releaseItems.length,
				hasSelectedItem: selectedItem !== null,
				isLoading: loadingEl !== null,
				hasDownloadBtn: downloadBtn !== null,
				btnDisabled: downloadBtn ? downloadBtn.disabled : null,
				btnText: downloadBtn ? downloadBtn.textContent.trim() : null,
				hasError: errorEl !== null,
				errorText: errorEl ? errorEl.textContent : null
			});
		})()
	`

	t.app.downloaderWindow.ExecJS(js)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"windowOpen": true,
		"jsExecuted": true,
	})
}

func (t *TestAPI) handleUIDownloaderSetMode(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Mode string `json:"mode"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if t.app.downloaderWindow == nil {
		http.Error(w, "Downloader window not open", http.StatusBadRequest)
		return
	}

	js := fmt.Sprintf(`
		(function() {
			const tabs = document.querySelectorAll('.mode-tab, .tab-btn, [data-mode]');
			for (const tab of tabs) {
				if (tab.dataset.mode === %q || tab.textContent.toLowerCase().includes(%q)) {
					tab.click();
					return true;
				}
			}
			return false;
		})()
	`, req.Mode, req.Mode)

	t.app.downloaderWindow.ExecJS(js)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"set": true})
}

func (t *TestAPI) handleUIDownloaderStartNative(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		PythonPath string `json:"pythonPath"`
		Branch     string `json:"branch"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Branch == "" {
		req.Branch = "master"
	}

	if req.PythonPath == "" {
		candidates := t.app.DetectPythonCandidates()
		if len(candidates) > 0 {
			req.PythonPath = candidates[0].Path
		} else {
			http.Error(w, "No Python candidates found", http.StatusBadRequest)
			return
		}
	}

	go func() {
		log.Printf("[TestAPI] Starting native setup: python=%s branch=%s", req.PythonPath, req.Branch)
		if err := t.app.SetupNativeBackend(req.PythonPath, req.Branch); err != nil {
			log.Printf("[TestAPI] Native setup error: %v", err)
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"started":    true,
		"pythonPath": req.PythonPath,
		"branch":     req.Branch,
	})
}

func (t *TestAPI) handleOpenValkeyDownloader(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	t.app.showValkeyDownloadDialog()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"opened": true})
}

func (t *TestAPI) handleUIPythonSetCustomPath(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Path string `json:"path"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if t.app.pythonSelectionWindow == nil {
		http.Error(w, "Python selection window not open", http.StatusBadRequest)
		return
	}

	js := fmt.Sprintf(`
		(function() {
			const input = document.querySelector('#customPath, input[name="customPath"], .custom-path-input');
			if (input) {
				input.value = %q;
				input.dispatchEvent(new Event('input', {bubbles: true}));
				return true;
			}
			return false;
		})()
	`, req.Path)

	t.app.pythonSelectionWindow.ExecJS(js)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"set": true})
}

func (t *TestAPI) handleUIPythonToggleVenv(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Enabled bool `json:"enabled"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if t.app.pythonSelectionWindow == nil {
		http.Error(w, "Python selection window not open", http.StatusBadRequest)
		return
	}

	js := fmt.Sprintf(`
		(function() {
			const checkbox = document.querySelector('.cupcake-checkbox input[type="checkbox"], #createVenv, input[name="createVenv"], .venv-checkbox');
			if (checkbox) {
				if (checkbox.checked !== %t) {
					checkbox.click();
				}
				return true;
			}
			return false;
		})()
	`, req.Enabled)

	t.app.pythonSelectionWindow.ExecJS(js)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"toggled": true})
}

func (t *TestAPI) handleUIPythonSubmit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if t.app.pythonSelectionWindow == nil {
		http.Error(w, "Python selection window not open", http.StatusBadRequest)
		return
	}

	js := `
		(function() {
			const btn = document.querySelector('.cupcake-btn.primary, .btn-proceed, .btn-primary, button[type="submit"], .continue-btn');
			if (btn && !btn.disabled) {
				btn.click();
				return true;
			}
			return false;
		})()
	`

	t.app.pythonSelectionWindow.ExecJS(js)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"submitted": true})
}

func (t *TestAPI) handleUIPythonCandidates(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	candidates := t.app.DetectPythonCandidates()
	json.NewEncoder(w).Encode(map[string]interface{}{
		"candidates": candidates,
		"count":      len(candidates),
	})
}

func (t *TestAPI) handleUISuperuserDiagnose(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if t.app.superuserWindow == nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"windowOpen": false,
		})
		return
	}

	js := `
		(function() {
			const username = document.querySelector('#username');
			const email = document.querySelector('#email');
			const password = document.querySelector('#password');
			const confirmPassword = document.querySelector('#confirmPassword');
			const submitBtn = document.querySelector('.btn-primary');
			const errorEl = document.querySelector('.error-message');
			const successEl = document.querySelector('.success-message');

			return JSON.stringify({
				usernameValue: username ? username.value : null,
				emailValue: email ? email.value : null,
				passwordValue: password ? password.value : null,
				confirmPasswordValue: confirmPassword ? confirmPassword.value : null,
				submitBtnExists: submitBtn !== null,
				submitBtnDisabled: submitBtn ? submitBtn.disabled : null,
				submitBtnText: submitBtn ? submitBtn.textContent.trim() : null,
				hasError: errorEl !== null,
				errorText: errorEl ? errorEl.textContent : null,
				hasSuccess: successEl !== null
			});
		})()
	`

	t.app.superuserWindow.ExecJS(js)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"windowOpen": true,
		"jsExecuted": true,
	})
}

func (t *TestAPI) handleUISuperuserSkip(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if t.app.superuserWindow == nil {
		http.Error(w, "Superuser window not open", http.StatusBadRequest)
		return
	}

	js := `
		(function() {
			const skipBtn = document.querySelector('.cupcake-btn.outline, .btn-secondary, .skip-btn');
			if (skipBtn) {
				skipBtn.click();
				return true;
			}
			return false;
		})()
	`

	t.app.superuserWindow.ExecJS(js)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"skipped": true})
}

func (t *TestAPI) handleResetConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if t.app.pythonManager != nil {
		t.app.pythonManager.ResetConfig()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"reset": true})
}

func (t *TestAPI) handleDeleteBackend(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	backendPath := t.app.getBackendPath()
	if err := os.RemoveAll(backendPath); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"deleted": true})
}

func (t *TestAPI) handleUserCount(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	log.Printf("[TestAPI] handleUserCount called")
	log.Printf("[TestAPI] userManager initialized: %v", t.app.userManager != nil)
	log.Printf("[TestAPI] venvPath: %s", t.app.venvPath)

	if t.app.userManager == nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"count": 0,
			"error": "User manager not initialized",
		})
		return
	}

	backendDir := t.app.getBackendPath()
	log.Printf("[TestAPI] backendDir: %s", backendDir)

	count, err := t.app.userManager.GetUserCount(backendDir, t.app.venvPath)
	if err != nil {
		log.Printf("[TestAPI] GetUserCount error: %v", err)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"count":      0,
			"error":      err.Error(),
			"backendDir": backendDir,
			"venvPath":   t.app.venvPath,
		})
		return
	}

	log.Printf("[TestAPI] User count: %d", count)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"count":      count,
		"backendDir": backendDir,
		"venvPath":   t.app.venvPath,
	})
}

func (t *TestAPI) handleSyncSchemas(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var options models.SyncSchemasOptions
	if r.Body != nil {
		json.NewDecoder(r.Body).Decode(&options)
	}

	go func() {
		log.Println("[TestAPI] Starting sync schemas...")
		if err := t.app.RunSyncSchemas(options); err != nil {
			log.Printf("[TestAPI] Sync schemas error: %v", err)
		} else {
			log.Println("[TestAPI] Sync schemas completed")
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"started": true})
}

func (t *TestAPI) handleLoadColumnTemplates(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var options models.LoadColumnTemplatesOptions
	if r.Body != nil {
		json.NewDecoder(r.Body).Decode(&options)
	}

	go func() {
		log.Println("[TestAPI] Starting load column templates...")
		if err := t.app.RunLoadColumnTemplates(options); err != nil {
			log.Printf("[TestAPI] Load column templates error: %v", err)
		} else {
			log.Println("[TestAPI] Load column templates completed")
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"started": true})
}

func (t *TestAPI) handleLoadOntologies(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var options models.LoadOntologiesOptions
	if r.Body != nil {
		json.NewDecoder(r.Body).Decode(&options)
	}

	go func() {
		log.Println("[TestAPI] Starting load ontologies...")
		if err := t.app.RunLoadOntologies(options); err != nil {
			log.Printf("[TestAPI] Load ontologies error: %v", err)
		} else {
			log.Println("[TestAPI] Load ontologies completed")
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"started": true})
}

func (t *TestAPI) handleSchemaCount(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	count, err := t.app.GetSchemaCount()
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"count": 0,
			"error": err.Error(),
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"count": count,
	})
}

func (t *TestAPI) handleColumnTemplateCount(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	count, err := t.app.GetColumnTemplateCount()
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"count": 0,
			"error": err.Error(),
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"count": count,
	})
}

func (t *TestAPI) handleOntologyCounts(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	counts, err := t.app.GetOntologyCounts()
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"counts": nil,
			"error":  err.Error(),
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"counts": counts,
	})
}

func (t *TestAPI) handleOpenManagement(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	t.app.OpenManagementPanel()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"opened": true})
}

func (t *TestAPI) handleUIManagementClickCommand(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Command string `json:"command"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if t.app.managementWindow == nil {
		http.Error(w, "Management window not open", http.StatusBadRequest)
		return
	}

	js := fmt.Sprintf(`
		(function() {
			const commandItems = document.querySelectorAll('.command-card, .command-item');
			for (const item of commandItems) {
				const nameEl = item.querySelector('.command-name');
				if (nameEl && nameEl.textContent.toLowerCase().includes(%q)) {
					const btn = item.querySelector('.action-btn, .cupcake-btn, .btn-run, button');
					if (btn && !btn.disabled) {
						btn.click();
						return JSON.stringify({clicked: true, command: %q, buttonText: btn.textContent.trim()});
					}
					return JSON.stringify({clicked: false, reason: 'button disabled or not found', command: %q});
				}
			}
			return JSON.stringify({clicked: false, reason: 'command not found', command: %q});
		})()
	`, req.Command, req.Command, req.Command, req.Command)

	t.app.managementWindow.ExecJS(js)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"clicked": true,
		"command": req.Command,
	})
}

func (t *TestAPI) handleUIManagementGetStats(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if t.app.managementWindow == nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"windowOpen": false,
		})
		return
	}

	js := `
		(function() {
			const stats = {};
			const statItems = document.querySelectorAll('.stat-item');
			for (const item of statItems) {
				const value = item.querySelector('.stat-value');
				const label = item.querySelector('.stat-label');
				if (value && label) {
					stats[label.textContent.toLowerCase().replace(/\\s+/g, '_')] = parseInt(value.textContent) || 0;
				}
			}

			const ontologyItems = document.querySelectorAll('.ontology-item');
			const ontologies = {};
			for (const item of ontologyItems) {
				const name = item.querySelector('.ontology-name');
				const count = item.querySelector('.ontology-count');
				if (name && count) {
					ontologies[name.textContent.toLowerCase()] = parseInt(count.textContent) || 0;
				}
			}

			return JSON.stringify({stats, ontologies});
		})()
	`

	t.app.managementWindow.ExecJS(js)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"windowOpen": true,
		"jsExecuted": true,
	})
}

func (t *TestAPI) handleUIManagementGetCommandStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req struct {
		Command string `json:"command"`
	}

	if r.Method == http.MethodPost {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	} else {
		req.Command = r.URL.Query().Get("command")
	}

	if t.app.managementWindow == nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"windowOpen": false,
		})
		return
	}

	js := fmt.Sprintf(`
		(function() {
			const commandItems = document.querySelectorAll('.command-item');
			for (const item of commandItems) {
				const nameEl = item.querySelector('.command-name');
				if (nameEl && nameEl.textContent.toLowerCase().includes(%q)) {
					const btn = item.querySelector('.btn-run');
					const countEl = item.querySelector('.command-count');

					const isRunning = btn && btn.classList.contains('running');
					const btnText = btn ? btn.textContent.trim() : '';
					const success = btnText.includes('✓') ? true : (btnText.includes('✕') ? false : null);
					const count = countEl ? parseInt(countEl.textContent) : null;

					return JSON.stringify({
						found: true,
						command: %q,
						running: isRunning,
						success: success,
						count: count,
						buttonText: btnText
					});
				}
			}
			return JSON.stringify({found: false, command: %q});
		})()
	`, req.Command, req.Command, req.Command)

	t.app.managementWindow.ExecJS(js)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"windowOpen": true,
		"jsExecuted": true,
	})
}

func (t *TestAPI) handleUIManagementWaitForCommand(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Command string `json:"command"`
		Timeout int    `json:"timeout"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Timeout == 0 {
		req.Timeout = 60000
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"started": true,
		"command": req.Command,
		"timeout": req.Timeout,
	})
}

func (t *TestAPI) handleBackupCreateDatabase(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	log.Println("[TestAPI] Creating database backup...")
	err := t.app.CreateDatabaseBackup()

	w.Header().Set("Content-Type", "application/json")
	if err != nil {
		log.Printf("[TestAPI] Database backup error: %v", err)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	log.Println("[TestAPI] Database backup completed")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Database backup created",
	})
}

func (t *TestAPI) handleBackupCreateMedia(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	log.Println("[TestAPI] Creating media backup...")
	err := t.app.CreateMediaBackup()

	w.Header().Set("Content-Type", "application/json")
	if err != nil {
		log.Printf("[TestAPI] Media backup error: %v", err)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	log.Println("[TestAPI] Media backup completed")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Media backup created",
	})
}

func (t *TestAPI) handleBackupCreateFull(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	log.Println("[TestAPI] Creating full backup...")
	err := t.app.CreateFullBackup()

	w.Header().Set("Content-Type", "application/json")
	if err != nil {
		log.Printf("[TestAPI] Full backup error: %v", err)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	log.Println("[TestAPI] Full backup completed")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Full backup created",
	})
}

func (t *TestAPI) handleBackupRestoreDatabase(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	log.Println("[TestAPI] Restoring database...")
	err := t.app.RestoreDatabase()

	w.Header().Set("Content-Type", "application/json")
	if err != nil {
		log.Printf("[TestAPI] Database restore error: %v", err)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	log.Println("[TestAPI] Database restored")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Database restored",
	})
}

func (t *TestAPI) handleBackupRestoreMedia(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	log.Println("[TestAPI] Restoring media...")
	err := t.app.RestoreMedia()

	w.Header().Set("Content-Type", "application/json")
	if err != nil {
		log.Printf("[TestAPI] Media restore error: %v", err)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	log.Println("[TestAPI] Media restored")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Media restored",
	})
}

func (t *TestAPI) handleBackupList(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	backups, err := t.app.ListBackups()
	if err != nil {
		log.Printf("[TestAPI] List backups error: %v", err)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"backups": []interface{}{},
			"error":   err.Error(),
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"backups": backups,
		"count":   len(backups),
	})
}

func (t *TestAPI) handleBackupDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Path string `json:"path"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	log.Printf("[TestAPI] Deleting backup: %s", req.Path)
	err := t.app.DeleteBackup(req.Path)

	w.Header().Set("Content-Type", "application/json")
	if err != nil {
		log.Printf("[TestAPI] Delete backup error: %v", err)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	log.Println("[TestAPI] Backup deleted")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Backup deleted",
	})
}

func (t *TestAPI) handleBackupSeedInitialDatabase(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		DestPath string `json:"destPath"`
		Content  string `json:"content"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.DestPath == "" {
		req.DestPath = os.TempDir()
	}

	seedFile := req.DestPath + "/test-initial.sqlite3"
	content := []byte(req.Content)
	if len(content) == 0 {
		content = []byte("SQLite format 3\x00test-initial-database-seed-content")
	}

	if err := os.MkdirAll(req.DestPath, 0755); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := os.WriteFile(seedFile, content, 0644); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	log.Printf("[TestAPI] Seeded initial database at: %s (%d bytes)", seedFile, len(content))
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"path":    seedFile,
		"size":    len(content),
	})
}

func (t *TestAPI) handleBackupImportInitialDatabase(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		FilePath string `json:"filePath"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.FilePath == "" {
		http.Error(w, "filePath is required", http.StatusBadRequest)
		return
	}

	if t.app.backupManager == nil {
		http.Error(w, "backup manager not initialized", http.StatusInternalServerError)
		return
	}

	backendDir := t.app.getBackendPath()
	log.Printf("[TestAPI] Importing initial database from: %s into backendDir: %s", req.FilePath, backendDir)

	if err := t.app.backupManager.ImportDatabaseFromFile(req.FilePath, backendDir); err != nil {
		log.Printf("[TestAPI] Import initial database error: %v", err)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	log.Println("[TestAPI] Initial database imported successfully")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"message":    "Initial database imported",
		"backendDir": backendDir,
	})
}
