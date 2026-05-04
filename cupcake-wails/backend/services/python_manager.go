package services

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"

	"github.com/noatgnu/cupcake-webgui/cupcake-wails/backend/models"
)

type PythonManager struct {
	userDataPath string
	configPath   string
	logCallback  func(message string, msgType string)
}

func NewPythonManager(userDataPath string) *PythonManager {
	return &PythonManager{
		userDataPath: userDataPath,
		configPath:   filepath.Join(userDataPath, "python-config.json"),
	}
}

func (p *PythonManager) SetLogCallback(callback func(message string, msgType string)) {
	p.logCallback = callback
}

func (p *PythonManager) log(message string, msgType string) {
	log.Printf("[PythonManager] [%s] %s", msgType, message)
	if p.logCallback != nil {
		p.logCallback(message, msgType)
	}
}

func (p *PythonManager) LoadConfig() models.PythonConfig {
	var config models.PythonConfig

	data, err := os.ReadFile(p.configPath)
	if err != nil {
		return config
	}

	json.Unmarshal(data, &config)
	return config
}

func (p *PythonManager) SaveConfig(config models.PythonConfig) error {
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(p.configPath, data, 0644)
}

func (p *PythonManager) ResetConfig() error {
	return os.Remove(p.configPath)
}

func (p *PythonManager) IsConfigurationValid() bool {
	config := p.LoadConfig()
	if config.PythonPath == "" {
		return false
	}

	result := p.VerifyPython(config.PythonPath)
	return result.Valid
}

func (p *PythonManager) DetectPythonCandidates() []models.PythonCandidate {
	var candidates []models.PythonCandidate
	seen := make(map[string]bool)

	pythonCommands := []string{"python3.12", "python3.13", "python3", "python"}
	if runtime.GOOS == "windows" {
		pythonCommands = append(pythonCommands, "py -3.12", "py -3.13", "py -3")
	}

	for _, cmd := range pythonCommands {
		parts := strings.Fields(cmd)
		path, err := exec.LookPath(parts[0])
		if err != nil {
			continue
		}

		var fullPath string
		if len(parts) > 1 {
			fullPath = cmd
		} else {
			fullPath = path
		}

		if seen[fullPath] {
			continue
		}

		result := p.VerifyPython(fullPath)
		if result.Valid {
			seen[fullPath] = true
			candidates = append(candidates, models.PythonCandidate{
				Command: cmd,
				Version: result.Version,
				Path:    fullPath,
			})
		}
	}

	pyenvRoot := os.Getenv("PYENV_ROOT")
	if pyenvRoot == "" {
		pyenvRoot = filepath.Join(os.Getenv("HOME"), ".pyenv")
	}
	versionsDir := filepath.Join(pyenvRoot, "versions")
	if entries, err := os.ReadDir(versionsDir); err == nil {
		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}
			pyPath := filepath.Join(versionsDir, entry.Name(), "bin", "python")
			if runtime.GOOS == "windows" {
				pyPath = filepath.Join(versionsDir, entry.Name(), "python.exe")
			}
			if _, err := os.Stat(pyPath); err == nil && !seen[pyPath] {
				result := p.VerifyPython(pyPath)
				if result.Valid {
					seen[pyPath] = true
					candidates = append(candidates, models.PythonCandidate{
						Command: entry.Name(),
						Version: result.Version,
						Path:    pyPath,
					})
				}
			}
		}
	}

	condaRoot := os.Getenv("CONDA_PREFIX")
	if condaRoot != "" {
		envsDir := filepath.Join(filepath.Dir(condaRoot), "envs")
		if entries, err := os.ReadDir(envsDir); err == nil {
			for _, entry := range entries {
				if !entry.IsDir() {
					continue
				}
				var pyPath string
				if runtime.GOOS == "windows" {
					pyPath = filepath.Join(envsDir, entry.Name(), "python.exe")
				} else {
					pyPath = filepath.Join(envsDir, entry.Name(), "bin", "python")
				}
				if _, err := os.Stat(pyPath); err == nil && !seen[pyPath] {
					result := p.VerifyPython(pyPath)
					if result.Valid {
						seen[pyPath] = true
						candidates = append(candidates, models.PythonCandidate{
							Command: fmt.Sprintf("conda/%s", entry.Name()),
							Version: result.Version,
							Path:    pyPath,
						})
					}
				}
			}
		}
	}

	return candidates
}

func (p *PythonManager) VerifyPython(pythonPath string) models.ValidationResult {
	parts := strings.Fields(pythonPath)
	var cmd *exec.Cmd
	if len(parts) > 1 {
		cmd = exec.Command(parts[0], append(parts[1:], "--version")...)
	} else {
		cmd = exec.Command(pythonPath, "--version")
	}
	hideWindow(cmd)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return models.ValidationResult{
			Valid:   false,
			Message: fmt.Sprintf("Failed to execute Python: %v", err),
		}
	}

	versionStr := strings.TrimSpace(string(output))
	versionMatch := regexp.MustCompile(`Python\s+(\d+\.\d+\.\d+)`).FindStringSubmatch(versionStr)
	if len(versionMatch) < 2 {
		return models.ValidationResult{
			Valid:   false,
			Message: "Could not parse Python version",
		}
	}

	version := versionMatch[1]
	versionParts := strings.Split(version, ".")
	if len(versionParts) < 2 {
		return models.ValidationResult{
			Valid:   false,
			Message: "Invalid version format",
		}
	}

	major, _ := strconv.Atoi(versionParts[0])
	minor, _ := strconv.Atoi(versionParts[1])

	if major < 3 || (major == 3 && minor < 12) {
		return models.ValidationResult{
			Valid:   false,
			Message: fmt.Sprintf("Python %s is too old. Requires Python 3.12+", version),
			Version: version,
		}
	}

	return models.ValidationResult{
		Valid:   true,
		Version: version,
		Message: "Python version is compatible",
	}
}

func (p *PythonManager) CreateVirtualEnvironment(basePythonPath string) (string, error) {
	venvDir := filepath.Join(p.userDataPath, "venv")

	if _, err := os.Stat(venvDir); err == nil {
		p.log("Removing existing virtual environment...", "info")
		os.RemoveAll(venvDir)
	}

	p.log(fmt.Sprintf("Creating virtual environment using %s...", basePythonPath), "info")

	parts := strings.Fields(basePythonPath)
	var cmd *exec.Cmd
	if len(parts) > 1 {
		cmd = exec.Command(parts[0], append(parts[1:], "-m", "venv", venvDir)...)
	} else {
		cmd = exec.Command(basePythonPath, "-m", "venv", venvDir)
	}
	hideWindow(cmd)

	output, err := cmd.CombinedOutput()
	if err != nil {
		p.log(fmt.Sprintf("Virtual environment creation failed: %v", err), "error")
		return "", fmt.Errorf("failed to create venv: %v, output: %s", err, string(output))
	}

	var venvPython string
	if runtime.GOOS == "windows" {
		venvPython = filepath.Join(venvDir, "Scripts", "python.exe")
	} else {
		venvPython = filepath.Join(venvDir, "bin", "python")
	}

	if _, err := os.Stat(venvPython); os.IsNotExist(err) {
		p.log("Virtual environment Python executable not found", "error")
		return "", fmt.Errorf("venv Python not found at %s", venvPython)
	}

	config := p.LoadConfig()
	config.VenvPath = venvPython
	p.SaveConfig(config)

	p.log("Virtual environment created successfully", "success")
	return venvPython, nil
}

func (p *PythonManager) CheckVirtualEnvironment() string {
	config := p.LoadConfig()
	if config.VenvPath != "" {
		if _, err := os.Stat(config.VenvPath); err == nil {
			return config.VenvPath
		}
	}

	venvDir := filepath.Join(p.userDataPath, "venv")
	var venvPython string
	if runtime.GOOS == "windows" {
		venvPython = filepath.Join(venvDir, "Scripts", "python.exe")
	} else {
		venvPython = filepath.Join(venvDir, "bin", "python")
	}

	if _, err := os.Stat(venvPython); err == nil {
		return venvPython
	}

	return ""
}

func (p *PythonManager) InstallDependencies(pythonPath, requirementsPath string) error {
	if _, err := os.Stat(requirementsPath); os.IsNotExist(err) {
		p.log("No requirements.txt found, skipping dependency installation", "warning")
		return nil
	}

	p.log("Installing Python dependencies...", "info")

	cmd := exec.Command(pythonPath, "-m", "pip", "install", "--progress-bar", "off", "-r", requirementsPath)
	hideWindow(cmd)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %v", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to create stderr pipe: %v", err)
	}

	if err := cmd.Start(); err != nil {
		p.log(fmt.Sprintf("Failed to start pip: %v", err), "error")
		return err
	}

	go func() {
		buf := make([]byte, 1024)
		for {
			n, err := stdout.Read(buf)
			if n > 0 {
				lines := strings.Split(string(buf[:n]), "\n")
				for _, line := range lines {
					line = strings.TrimSpace(line)
					if line != "" && strings.Contains(line, "Successfully installed") {
						p.log(line, "success")
					} else if line != "" && (strings.HasPrefix(line, "Collecting") || strings.HasPrefix(line, "Installing") || strings.HasPrefix(line, "Downloading")) {
						p.log(line, "info")
					}
				}
			}
			if err != nil {
				break
			}
		}
	}()

	go func() {
		buf := make([]byte, 1024)
		for {
			n, err := stderr.Read(buf)
			if n > 0 {
				lines := strings.Split(string(buf[:n]), "\n")
				for _, line := range lines {
					line = strings.TrimSpace(line)
					if line != "" && !strings.HasPrefix(line, "WARNING:") {
						p.log(line, "warning")
					}
				}
			}
			if err != nil {
				break
			}
		}
	}()

	if err := cmd.Wait(); err != nil {
		p.log(fmt.Sprintf("Dependency installation failed: %v", err), "error")
		return fmt.Errorf("pip install failed: %v", err)
	}

	p.log("All dependencies installed successfully", "success")
	return nil
}

func (p *PythonManager) GetPipList(pythonPath string) ([]string, error) {
	cmd := exec.Command(pythonPath, "-m", "pip", "list", "--format=freeze")
	hideWindow(cmd)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, err
	}

	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	return lines, nil
}
