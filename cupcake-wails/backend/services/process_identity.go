package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// DescribeProcess returns the executable path and command line of a running process, or an error when it is not
// running or cannot be inspected.
func DescribeProcess(pid int) (string, error) {
	switch runtime.GOOS {
	case "linux":
		cmdline, err := os.ReadFile(fmt.Sprintf("/proc/%d/cmdline", pid))
		if err != nil {
			return "", err
		}
		executable, _ := os.Readlink(fmt.Sprintf("/proc/%d/exe", pid))
		return executable + "\n" + strings.ReplaceAll(string(cmdline), "\x00", " "), nil
	case "windows":
		script := fmt.Sprintf("$p = Get-CimInstance Win32_Process -Filter 'ProcessId=%d'; if ($p) { $p.ExecutablePath; $p.CommandLine } else { exit 1 }", pid)
		cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", script)
		hideWindow(cmd)
		output, err := cmd.Output()
		if err != nil {
			return "", err
		}
		return string(output), nil
	default:
		cmd := exec.Command("ps", "-ww", "-o", "comm=", "-o", "args=", "-p", fmt.Sprintf("%d", pid))
		output, err := cmd.Output()
		if err != nil {
			return "", err
		}
		if strings.TrimSpace(string(output)) == "" {
			return "", fmt.Errorf("process %d is not running", pid)
		}
		return string(output), nil
	}
}

// ProcessMarker is the text that identifies a process started from path: the path with symbolic links resolved.
func ProcessMarker(path string) string {
	if resolved, err := filepath.EvalSymlinks(path); err == nil {
		return resolved
	}
	return path
}

// DescriptionMatches reports whether a process description names marker; paths are compared without case on
// Windows and macOS.
func DescriptionMatches(description, marker string) bool {
	if marker == "" {
		return false
	}
	if runtime.GOOS == "windows" || runtime.GOOS == "darwin" {
		return strings.Contains(strings.ToLower(description), strings.ToLower(marker))
	}
	return strings.Contains(description, marker)
}
