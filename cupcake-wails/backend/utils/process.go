package utils

import (
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"syscall"
)

func IsProcessRunning(pid int) bool {
	process, err := os.FindProcess(pid)
	if err != nil {
		return false
	}

	err = process.Signal(syscall.Signal(0))
	return err == nil
}

func KillProcess(pid int) error {
	process, err := os.FindProcess(pid)
	if err != nil {
		return err
	}
	return process.Kill()
}

func KillProcessByName(name string) error {
	if runtime.GOOS == "windows" {
		cmd := exec.Command("taskkill", "/F", "/IM", name)
		HideWindow(cmd)
		return cmd.Run()
	}

	cmd := exec.Command("pkill", "-f", name)
	HideWindow(cmd)
	return cmd.Run()
}

func GetProcessIDByPort(port int) (int, error) {
	var cmd *exec.Cmd

	if runtime.GOOS == "windows" {
		cmd = exec.Command("netstat", "-ano")
	} else {
		cmd = exec.Command("lsof", "-ti", ":"+strconv.Itoa(port))
	}
	HideWindow(cmd)

	output, err := cmd.Output()
	if err != nil {
		return 0, err
	}

	if runtime.GOOS == "windows" {
		lines := strings.Split(string(output), "\n")
		portStr := ":" + strconv.Itoa(port)
		for _, line := range lines {
			if strings.Contains(line, portStr) && strings.Contains(line, "LISTENING") {
				fields := strings.Fields(line)
				if len(fields) >= 5 {
					pid, err := strconv.Atoi(fields[len(fields)-1])
					if err == nil {
						return pid, nil
					}
				}
			}
		}
		return 0, nil
	}

	pidStr := strings.TrimSpace(string(output))
	if pidStr == "" {
		return 0, nil
	}

	return strconv.Atoi(strings.Split(pidStr, "\n")[0])
}

func GetChildProcesses(pid int) ([]int, error) {
	var cmd *exec.Cmd
	var pids []int

	if runtime.GOOS == "windows" {
		cmd = exec.Command("wmic", "process", "where", "(ParentProcessId="+strconv.Itoa(pid)+")", "get", "ProcessId")
	} else {
		cmd = exec.Command("pgrep", "-P", strconv.Itoa(pid))
	}
	HideWindow(cmd)

	output, err := cmd.Output()
	if err != nil {
		return pids, nil
	}

	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || line == "ProcessId" {
			continue
		}
		childPid, err := strconv.Atoi(line)
		if err == nil {
			pids = append(pids, childPid)
		}
	}

	return pids, nil
}

func KillProcessTree(pid int) error {
	children, _ := GetChildProcesses(pid)

	for _, childPid := range children {
		KillProcessTree(childPid)
	}

	return KillProcess(pid)
}
