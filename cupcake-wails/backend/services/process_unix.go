//go:build !windows

package services

import (
	"os/exec"
)

func hideWindow(cmd *exec.Cmd) {
	// No-op on non-Windows platforms
}
