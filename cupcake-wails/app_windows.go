//go:build windows

package main

import (
	"fmt"
	"os/exec"
	"syscall"
)

func hideConsoleWindow(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000,
	}
}

func setProcessGroup(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000 | syscall.CREATE_NEW_PROCESS_GROUP,
	}
}

func killProcessGroup(pid int) error {
	cmd := exec.Command("taskkill", "/F", "/T", "/PID", fmt.Sprintf("%d", pid))
	return cmd.Run()
}

func openFolder(path string) error {
	cmd := exec.Command("explorer", path)
	return cmd.Start()
}

func openFile(path string) error {
	cmd := exec.Command("cmd", "/c", "start", "", path)
	return cmd.Start()
}
