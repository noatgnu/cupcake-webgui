package services

import (
	"bufio"
	"fmt"
	"log"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"
)

type BackendManager struct {
	userDataPath    string
	isDev           bool
	redisManager    *RedisManager
	backendPort     int
	djangoProcess   *os.Process
	rqProcess       *os.Process
	gunicornProcess *os.Process
	logCallback     func(message string, msgType string)
	statusCallback  func(service, status, message string)
}

func NewBackendManager(userDataPath string, isDev bool, redisManager *RedisManager) *BackendManager {
	return &BackendManager{
		userDataPath: userDataPath,
		isDev:        isDev,
		redisManager: redisManager,
		backendPort:  8000,
	}
}

func (b *BackendManager) SetLogCallback(callback func(message string, msgType string)) {
	b.logCallback = callback
}

func (b *BackendManager) SetStatusCallback(callback func(service, status, message string)) {
	b.statusCallback = callback
}

func (b *BackendManager) log(message, msgType string) {
	log.Printf("[BackendManager] [%s] %s", msgType, message)
	if b.logCallback != nil {
		b.logCallback(message, msgType)
	}
}

func (b *BackendManager) GetBackendPort() int {
	return b.backendPort
}

func (b *BackendManager) RunMigrations(backendDir, pythonPath string) error {
	b.log("Running Django migrations...", "info")

	managePy := filepath.Join(backendDir, "manage.py")

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		wrapperScript := `
import sys
import multiprocessing

_original_get_context = multiprocessing.get_context
def _patched_get_context(method=None):
    if method == 'fork':
        return _original_get_context('spawn')
    return _original_get_context(method)
multiprocessing.get_context = _patched_get_context

import runpy
sys.argv = ['manage.py', 'migrate', '--no-input']
runpy.run_path('manage.py', run_name='__main__')
`
		cmd = exec.Command(pythonPath, "-c", wrapperScript)
	} else {
		cmd = exec.Command(pythonPath, managePy, "migrate", "--no-input")
	}
	cmd.Dir = backendDir
	cmd.Env = b.getBackendEnv(backendDir)
	hideWindow(cmd)

	output, err := cmd.CombinedOutput()
	if err != nil {
		b.log(fmt.Sprintf("Migration error: %s", string(output)), "error")
		return fmt.Errorf("migration failed: %w", err)
	}

	b.log("Migrations completed successfully", "success")
	return nil
}

func (b *BackendManager) CollectStaticFiles(backendDir, pythonPath string) error {
	b.log("Collecting static files...", "info")

	managePy := filepath.Join(backendDir, "manage.py")

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		wrapperScript := `
import sys
import multiprocessing

_original_get_context = multiprocessing.get_context
def _patched_get_context(method=None):
    if method == 'fork':
        return _original_get_context('spawn')
    return _original_get_context(method)
multiprocessing.get_context = _patched_get_context

import runpy
sys.argv = ['manage.py', 'collectstatic', '--no-input']
runpy.run_path('manage.py', run_name='__main__')
`
		cmd = exec.Command(pythonPath, "-c", wrapperScript)
	} else {
		cmd = exec.Command(pythonPath, managePy, "collectstatic", "--no-input")
	}
	cmd.Dir = backendDir
	cmd.Env = b.getBackendEnv(backendDir)
	hideWindow(cmd)

	output, err := cmd.CombinedOutput()
	if err != nil {
		b.log(fmt.Sprintf("Collectstatic warning: %s", string(output)), "warning")
		return nil
	}

	b.log("Static files collected", "success")
	return nil
}

func (b *BackendManager) StartRedisServer() error {
	if b.redisManager == nil {
		return fmt.Errorf("redis manager not initialized")
	}
	return b.redisManager.StartRedis()
}

func (b *BackendManager) StartDjangoServer(backendDir, pythonPath string) error {
	b.log("Starting Django server...", "info")

	if b.djangoProcess != nil {
		b.log("Django already running", "warning")
		return nil
	}

	availablePort := b.findAvailablePort(b.backendPort)
	b.backendPort = availablePort

	managePy := filepath.Join(backendDir, "manage.py")

	var cmd *exec.Cmd
	if b.isDev {
		if runtime.GOOS == "windows" {
			wrapperScript := fmt.Sprintf(`
import sys
import multiprocessing

_original_get_context = multiprocessing.get_context
def _patched_get_context(method=None):
    if method == 'fork':
        return _original_get_context('spawn')
    return _original_get_context(method)
multiprocessing.get_context = _patched_get_context

import runpy
sys.argv = ['manage.py', 'runserver', '0.0.0.0:%d']
runpy.run_path('manage.py', run_name='__main__')
`, availablePort)
			cmd = exec.Command(pythonPath, "-c", wrapperScript)
		} else {
			cmd = exec.Command(pythonPath, managePy, "runserver", fmt.Sprintf("0.0.0.0:%d", availablePort))
		}
	} else {
		if runtime.GOOS == "windows" {
			wrapperScript := fmt.Sprintf(`
import sys
import multiprocessing

_original_get_context = multiprocessing.get_context
def _patched_get_context(method=None):
    if method == 'fork':
        return _original_get_context('spawn')
    return _original_get_context(method)
multiprocessing.get_context = _patched_get_context

import uvicorn
uvicorn.run(
    'cupcake_vanilla.asgi_wails:application',
    host='0.0.0.0',
    port=%d,
    workers=1,
)
`, availablePort)
			cmd = exec.Command(pythonPath, "-c", wrapperScript)
		} else {
			cmd = exec.Command(pythonPath, "-m", "gunicorn",
				"--bind", fmt.Sprintf("0.0.0.0:%d", availablePort),
				"--workers", "4",
				"--timeout", "120",
				"cupcake_vanilla.wsgi:application",
			)
			b.gunicornProcess = nil
		}
	}

	cmd.Dir = backendDir
	cmd.Env = b.getBackendEnv(backendDir)
	hideWindow(cmd)

	stdout, _ := cmd.StdoutPipe()
	stderr, _ := cmd.StderrPipe()

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start Django: %w", err)
	}

	b.djangoProcess = cmd.Process
	if !b.isDev && runtime.GOOS != "windows" {
		b.gunicornProcess = cmd.Process
	}

	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			b.log(scanner.Text(), "info")
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			b.log(scanner.Text(), "error")
		}
	}()

	go func() {
		cmd.Wait()
		b.djangoProcess = nil
		b.gunicornProcess = nil
	}()

	maxRetries := 10
	for i := 0; i < maxRetries; i++ {
		time.Sleep(time.Second)
		if b.IsDjangoRunning() {
			b.log(fmt.Sprintf("Django server started on port %d", availablePort), "success")
			return nil
		}
		b.log(fmt.Sprintf("Waiting for Django server to start (attempt %d/%d)...", i+1, maxRetries), "info")
	}

	return fmt.Errorf("Django server failed to start after %d attempts", maxRetries)
}

func (b *BackendManager) StartRQWorker(backendDir, pythonPath string) error {
	b.log("Starting RQ worker...", "info")

	if b.rqProcess != nil {
		b.log("RQ worker already running", "warning")
		return nil
	}

	managePy := filepath.Join(backendDir, "manage.py")

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		wrapperScript := `
import sys
import multiprocessing

_original_get_context = multiprocessing.get_context
def _patched_get_context(method=None):
    if method == 'fork':
        return _original_get_context('spawn')
    return _original_get_context(method)
multiprocessing.get_context = _patched_get_context

import runpy
sys.argv = ['manage.py', 'rqworker', 'default', 'high', 'low']
runpy.run_path('manage.py', run_name='__main__')
`
		cmd = exec.Command(pythonPath, "-c", wrapperScript)
	} else {
		cmd = exec.Command(pythonPath, managePy, "rqworker", "default", "high", "low")
	}
	cmd.Dir = backendDir
	cmd.Env = b.getBackendEnv(backendDir)
	hideWindow(cmd)

	stdout, _ := cmd.StdoutPipe()
	stderr, _ := cmd.StderrPipe()

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start RQ worker: %w", err)
	}

	b.rqProcess = cmd.Process

	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			b.log(fmt.Sprintf("[RQ] %s", scanner.Text()), "info")
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			b.log(fmt.Sprintf("[RQ] %s", scanner.Text()), "error")
		}
	}()

	go func() {
		cmd.Wait()
		b.rqProcess = nil
	}()

	time.Sleep(time.Second)

	b.log("RQ worker started", "success")
	return nil
}

func (b *BackendManager) StopServices() {
	b.log("Stopping all services...", "info")

	if b.rqProcess != nil {
		b.stopProcess(b.rqProcess, "RQ worker")
		b.rqProcess = nil
	}

	if b.djangoProcess != nil {
		b.stopProcess(b.djangoProcess, "Django server")
		b.djangoProcess = nil
	}

	if b.gunicornProcess != nil {
		b.stopProcess(b.gunicornProcess, "Gunicorn")
		b.gunicornProcess = nil
	}

	if b.redisManager != nil {
		b.redisManager.StopRedis()
	}

	b.log("All services stopped", "success")
}

func (b *BackendManager) stopProcess(process *os.Process, name string) {
	b.log(fmt.Sprintf("Stopping %s...", name), "info")

	if err := process.Signal(syscall.SIGTERM); err != nil {
		process.Kill()
	}

	done := make(chan bool, 1)
	go func() {
		process.Wait()
		done <- true
	}()

	select {
	case <-done:
		b.log(fmt.Sprintf("%s stopped", name), "success")
	case <-time.After(5 * time.Second):
		process.Kill()
		b.log(fmt.Sprintf("%s forcefully killed", name), "warning")
	}
}

func (b *BackendManager) IsDjangoRunning() bool {
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", b.backendPort), time.Second)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

func (b *BackendManager) findAvailablePort(startPort int) int {
	for port := startPort; port < startPort+100; port++ {
		conn, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", port), 100*time.Millisecond)
		if err != nil {
			return port
		}
		conn.Close()
	}
	return startPort
}

func (b *BackendManager) getBackendEnv(backendDir string) []string {
	env := os.Environ()

	secretKey := "development-secret-key-change-in-production"
	dbPath := filepath.Join(backendDir, "db.sqlite3")
	mediaPath := filepath.Join(backendDir, "media")
	backupPath := filepath.Join(backendDir, "backups")

	debugValue := "false"
	if b.isDev {
		debugValue = "true"
	}

	customEnv := map[string]string{
		"DJANGO_SETTINGS_MODULE":        "cupcake_vanilla.settings_wails",
		"SECRET_KEY":                    secretKey,
		"DEBUG":                         debugValue,
		"WAILS_DEBUG":                   debugValue,
		"ALLOWED_HOSTS":                 "localhost,127.0.0.1",
		"DATABASE_URL":                  fmt.Sprintf("sqlite:///%s", dbPath),
		"REDIS_URL":                     b.redisManager.GetRedisURL(),
		"REDIS_HOST":                    "localhost",
		"REDIS_PORT":                    fmt.Sprintf("%d", b.redisManager.GetRedisPort()),
		"WAILS_APP_DATA":                backendDir,
		"MEDIA_ROOT":                    mediaPath,
		"DBBACKUP_STORAGE_LOCATION":     backupPath,
		"ENABLE_CUPCAKE_MACARON":        "true",
		"ENABLE_CUPCAKE_MINT_CHOCOLATE": "true",
		"ENABLE_CUPCAKE_RED_VELVET":     "true",
		"ENABLE_CUPCAKE_SALTED_CARAMEL": "true",
		"PYTHONDONTWRITEBYTECODE":       "1",
		"PYTHONUNBUFFERED":              "1",
	}

	for key, value := range customEnv {
		found := false
		for i, e := range env {
			if strings.HasPrefix(e, key+"=") {
				env[i] = fmt.Sprintf("%s=%s", key, value)
				found = true
				break
			}
		}
		if !found {
			env = append(env, fmt.Sprintf("%s=%s", key, value))
		}
	}

	return env
}

func (b *BackendManager) RunManagementCommand(backendDir, pythonPath, command string, args []string, outputCallback func(string, bool)) error {
	b.log(fmt.Sprintf("Running management command: %s", command), "info")

	managePy := filepath.Join(backendDir, "manage.py")

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		allArgs := append([]string{command}, args...)
		argsStr := "["
		for i, arg := range allArgs {
			if i > 0 {
				argsStr += ", "
			}
			argsStr += fmt.Sprintf("'%s'", strings.ReplaceAll(arg, "'", "\\'"))
		}
		argsStr += "]"

		wrapperScript := fmt.Sprintf(`
import sys
import multiprocessing

_original_get_context = multiprocessing.get_context
def _patched_get_context(method=None):
    if method == 'fork':
        return _original_get_context('spawn')
    return _original_get_context(method)
multiprocessing.get_context = _patched_get_context

import runpy
sys.argv = ['manage.py'] + %s
runpy.run_path('manage.py', run_name='__main__')
`, argsStr)
		cmd = exec.Command(pythonPath, "-c", wrapperScript)
	} else {
		cmdArgs := append([]string{managePy, command}, args...)
		cmd = exec.Command(pythonPath, cmdArgs...)
	}
	cmd.Dir = backendDir
	cmd.Env = b.getBackendEnv(backendDir)
	hideWindow(cmd)

	stdout, _ := cmd.StdoutPipe()
	stderr, _ := cmd.StderrPipe()

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start command: %w", err)
	}

	readOutput := func(reader *bufio.Reader, isError bool) {
		var lineBuffer strings.Builder
		for {
			char, err := reader.ReadByte()
			if err != nil {
				if lineBuffer.Len() > 0 {
					line := lineBuffer.String()
					b.log(line, map[bool]string{true: "error", false: "info"}[isError])
					if outputCallback != nil {
						outputCallback(line, isError)
					}
				}
				break
			}

			if char == '\n' || char == '\r' {
				if lineBuffer.Len() > 0 {
					line := lineBuffer.String()
					b.log(line, map[bool]string{true: "error", false: "info"}[isError])
					if outputCallback != nil {
						outputCallback(line, isError)
					}
					lineBuffer.Reset()
				}
			} else {
				lineBuffer.WriteByte(char)
			}
		}
	}

	go readOutput(bufio.NewReader(stdout), false)
	go readOutput(bufio.NewReader(stderr), true)

	if err := cmd.Wait(); err != nil {
		return fmt.Errorf("command failed: %w", err)
	}

	b.log(fmt.Sprintf("Command %s completed", command), "success")
	return nil
}

func (b *BackendManager) KillOrphanedProcesses() {
	b.log("Cleaning up orphaned processes...", "info")

	if b.redisManager != nil {
		b.redisManager.KillOrphanedRedisProcesses()
	}

	if runtime.GOOS == "windows" {
		cmd := exec.Command("taskkill", "/F", "/IM", "python.exe")
		hideWindow(cmd)
		cmd.Run()
	} else {
		cmd1 := exec.Command("pkill", "-f", "gunicorn.*catapult")
		hideWindow(cmd1)
		cmd1.Run()
		cmd2 := exec.Command("pkill", "-f", "rqworker")
		hideWindow(cmd2)
		cmd2.Run()
	}
}

func (b *BackendManager) GetSchemaCount(backendDir, pythonPath string) (int, error) {
	return b.runDjangoShellCommand(backendDir, pythonPath,
		"from ccv.models import Schema; print(Schema.objects.filter(is_builtin=True).count())")
}

func (b *BackendManager) GetColumnTemplateCount(backendDir, pythonPath string) (int, error) {
	return b.runDjangoShellCommand(backendDir, pythonPath,
		"from ccv.models import MetadataColumnTemplate; print(MetadataColumnTemplate.objects.count())")
}

func (b *BackendManager) GetOntologyCounts(backendDir, pythonPath string) (map[string]int, error) {
	counts := make(map[string]int)

	managePy := filepath.Join(backendDir, "manage.py")
	script := `
from ccv.models import (
    PSIMSOntology, CellOntology, MondoDisease, UberonAnatomy,
    Species, Unimod, Tissue, MSUniqueVocabularies,
    HumanDisease, SubcellularLocation, NCBITaxonomy, ChEBICompound
)
psims_count = PSIMSOntology.objects.count()
cell_count = CellOntology.objects.count()
mondo_count = MondoDisease.objects.count()
uberon_count = UberonAnatomy.objects.count()
species_count = Species.objects.count()
unimod_count = Unimod.objects.count()
tissue_count = Tissue.objects.count()
ms_vocab_count = MSUniqueVocabularies.objects.count()
human_disease_count = HumanDisease.objects.count()
subcellular_count = SubcellularLocation.objects.count()
ncbi_count = NCBITaxonomy.objects.count()
chebi_count = ChEBICompound.objects.count()
total = (psims_count + cell_count + mondo_count + uberon_count +
         species_count + unimod_count + tissue_count + ms_vocab_count +
         human_disease_count + subcellular_count + ncbi_count + chebi_count)
print(f'psims:{psims_count}')
print(f'cell:{cell_count}')
print(f'mondo:{mondo_count}')
print(f'uberon:{uberon_count}')
print(f'species:{species_count}')
print(f'unimod:{unimod_count}')
print(f'tissue:{tissue_count}')
print(f'msVocab:{ms_vocab_count}')
print(f'humanDisease:{human_disease_count}')
print(f'subcellularLoc:{subcellular_count}')
print(f'ncbi:{ncbi_count}')
print(f'chebi:{chebi_count}')
print(f'total:{total}')
`

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		escapedScript := strings.ReplaceAll(script, "'", "\\'")
		escapedScript = strings.ReplaceAll(escapedScript, "\n", "\\n")

		wrapperScript := fmt.Sprintf(`
import sys
import multiprocessing

_original_get_context = multiprocessing.get_context
def _patched_get_context(method=None):
    if method == 'fork':
        return _original_get_context('spawn')
    return _original_get_context(method)
multiprocessing.get_context = _patched_get_context

import runpy
sys.argv = ['manage.py', 'shell', '--no-startup', '-c', '''%s''']
runpy.run_path('manage.py', run_name='__main__')
`, escapedScript)
		cmd = exec.Command(pythonPath, "-c", wrapperScript)
	} else {
		cmd = exec.Command(pythonPath, managePy, "shell", "--no-startup", "-c", script)
	}
	cmd.Dir = backendDir
	cmd.Env = b.getBackendEnv(backendDir)
	hideWindow(cmd)

	output, err := cmd.CombinedOutput()
	if err != nil {
		b.log(fmt.Sprintf("GetOntologyCounts error: %v, output: %s", err, string(output)), "error")
		return nil, fmt.Errorf("%v: %s", err, string(output))
	}

	validOntologies := map[string]bool{
		"psims": true, "cell": true, "mondo": true, "uberon": true,
		"species": true, "unimod": true, "tissue": true, "msVocab": true,
		"humanDisease": true, "subcellularLoc": true, "ncbi": true, "chebi": true,
		"total": true,
	}

	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	for _, line := range lines {
		parts := strings.Split(line, ":")
		if len(parts) == 2 {
			name := strings.TrimSpace(parts[0])
			if validOntologies[name] {
				count, _ := strconv.Atoi(strings.TrimSpace(parts[1]))
				counts[name] = count
			}
		}
	}

	return counts, nil
}

func (b *BackendManager) runDjangoShellCommand(backendDir, pythonPath, script string) (int, error) {
	managePy := filepath.Join(backendDir, "manage.py")

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		escapedScript := strings.ReplaceAll(script, "\\", "\\\\")
		escapedScript = strings.ReplaceAll(escapedScript, "'", "\\'")
		escapedScript = strings.ReplaceAll(escapedScript, "\n", "\\n")

		wrapperScript := fmt.Sprintf(`
import sys
import multiprocessing

_original_get_context = multiprocessing.get_context
def _patched_get_context(method=None):
    if method == 'fork':
        return _original_get_context('spawn')
    return _original_get_context(method)
multiprocessing.get_context = _patched_get_context

import runpy
sys.argv = ['manage.py', 'shell', '--no-startup', '-c', '%s']
runpy.run_path('manage.py', run_name='__main__')
`, escapedScript)
		cmd = exec.Command(pythonPath, "-c", wrapperScript)
	} else {
		cmd = exec.Command(pythonPath, managePy, "shell", "--no-startup", "-c", script)
	}
	cmd.Dir = backendDir
	cmd.Env = b.getBackendEnv(backendDir)
	hideWindow(cmd)

	b.log(fmt.Sprintf("Running Django shell: python=%s, manage.py=%s", pythonPath, managePy), "info")

	output, err := cmd.CombinedOutput()
	outputStr := strings.TrimSpace(string(output))

	if err != nil {
		b.log(fmt.Sprintf("Django shell error: %v, output: %s", err, outputStr), "error")
		return 0, fmt.Errorf("%v: %s", err, outputStr)
	}

	lines := strings.Split(outputStr, "\n")
	lastLine := strings.TrimSpace(lines[len(lines)-1])

	count, err := strconv.Atoi(lastLine)
	if err != nil {
		b.log(fmt.Sprintf("Failed to parse count from last line: %s (full output: %s)", lastLine, outputStr), "error")
		return 0, fmt.Errorf("failed to parse count: %s", lastLine)
	}

	return count, nil
}
