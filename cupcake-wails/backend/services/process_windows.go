//go:build windows

package services

import (
	"os/exec"
	"syscall"
)

const (
	CREATE_NO_WINDOW       = 0x08000000
	CREATE_NEW_PROCESS_GROUP = 0x00000200
)

func hideWindow(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP,
	}
}
