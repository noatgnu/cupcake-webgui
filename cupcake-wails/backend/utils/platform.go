package utils

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

func GetPlatform() string {
	return runtime.GOOS
}

func GetArch() string {
	return runtime.GOARCH
}

func IsWindows() bool {
	return runtime.GOOS == "windows"
}

func IsMacOS() bool {
	return runtime.GOOS == "darwin"
}

func IsLinux() bool {
	return runtime.GOOS == "linux"
}

func GetExecutableName(name string) string {
	if IsWindows() {
		return name + ".exe"
	}
	return name
}

func GetPythonBinaryName() string {
	if IsWindows() {
		return "python.exe"
	}
	return "python3"
}

func GetUserDataPath() (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(configDir, "cupcake"), nil
}

func GetVenvPythonPath(venvDir string) string {
	if IsWindows() {
		return filepath.Join(venvDir, "Scripts", "python.exe")
	}
	return filepath.Join(venvDir, "bin", "python")
}

func GetVenvActivatePath(venvDir string) string {
	if IsWindows() {
		return filepath.Join(venvDir, "Scripts", "activate.bat")
	}
	return filepath.Join(venvDir, "bin", "activate")
}

func NormalizePath(path string) string {
	if IsWindows() {
		return strings.ReplaceAll(path, "/", "\\")
	}
	return strings.ReplaceAll(path, "\\", "/")
}

func ExpandPath(path string) string {
	if strings.HasPrefix(path, "~") {
		home, err := os.UserHomeDir()
		if err != nil {
			return path
		}
		return filepath.Join(home, path[1:])
	}
	return path
}
