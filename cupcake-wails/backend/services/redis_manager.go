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

type RedisNotFoundError struct {
	message string
}

func (e *RedisNotFoundError) Error() string {
	return e.message
}

func IsRedisNotFoundError(err error) bool {
	_, ok := err.(*RedisNotFoundError)
	return ok
}

type RedisManagerOptions struct {
	UserDataPath string
	IsDev        bool
}

type RedisManager struct {
	userDataPath string
	isDev        bool
	redisDir     string
	redisPort    int
	redisProcess *os.Process
	logCallback  func(message string, msgType string)
}

func NewRedisManager(opts RedisManagerOptions) *RedisManager {
	return &RedisManager{
		userDataPath: opts.UserDataPath,
		isDev:        opts.IsDev,
		redisDir:     filepath.Join(opts.UserDataPath, "redis"),
		redisPort:    6379,
	}
}

func (r *RedisManager) SetLogCallback(callback func(message string, msgType string)) {
	r.logCallback = callback
}

func (r *RedisManager) log(message, msgType string) {
	log.Printf("[RedisManager] [%s] %s", msgType, message)
	if r.logCallback != nil {
		r.logCallback(message, msgType)
	}
}

func (r *RedisManager) GetRedisDir() string {
	return r.redisDir
}

func (r *RedisManager) GetRedisPort() int {
	return r.redisPort
}

func (r *RedisManager) FindRedisServer() (string, error) {
	var serverName string
	if runtime.GOOS == "windows" {
		serverName = "redis-server.exe"
	} else {
		serverName = "valkey-server"
	}

	localPath := filepath.Join(r.redisDir, serverName)
	if _, err := os.Stat(localPath); err == nil {
		return localPath, nil
	}

	if runtime.GOOS != "windows" {
		redisPath := filepath.Join(r.redisDir, "redis-server")
		if _, err := os.Stat(redisPath); err == nil {
			return redisPath, nil
		}
	}

	if systemPath, err := exec.LookPath(serverName); err == nil {
		return systemPath, nil
	}
	if systemPath, err := exec.LookPath("redis-server"); err == nil {
		return systemPath, nil
	}

	return "", &RedisNotFoundError{
		message: fmt.Sprintf("Redis/Valkey server not found in %s or system PATH", r.redisDir),
	}
}

func (r *RedisManager) StartRedis() error {
	if r.IsRedisRunning() {
		r.log("Redis is already running", "info")
		return nil
	}

	serverPath, err := r.FindRedisServer()
	if err != nil {
		return err
	}

	r.log(fmt.Sprintf("Starting Redis from: %s", serverPath), "info")

	if err := os.MkdirAll(r.redisDir, 0755); err != nil {
		return fmt.Errorf("failed to create redis directory: %w", err)
	}

	availablePort := r.findAvailablePort(r.redisPort)
	r.redisPort = availablePort

	args := []string{
		"--port", strconv.Itoa(availablePort),
		"--daemonize", "no",
		"--appendonly", "yes",
		"--dir", r.redisDir,
	}

	cmd := exec.Command(serverPath, args...)
	cmd.Dir = r.redisDir
	hideWindow(cmd)

	stdout, _ := cmd.StdoutPipe()
	stderr, _ := cmd.StderrPipe()

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start Redis: %w", err)
	}

	r.redisProcess = cmd.Process

	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			r.log(scanner.Text(), "info")
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			r.log(scanner.Text(), "error")
		}
	}()

	go func() {
		cmd.Wait()
		r.redisProcess = nil
	}()

	time.Sleep(time.Second)

	if !r.IsRedisRunning() {
		return fmt.Errorf("redis failed to start")
	}

	r.log(fmt.Sprintf("Redis started on port %d", availablePort), "success")
	return nil
}

func (r *RedisManager) StopRedis() error {
	if r.redisProcess == nil {
		return nil
	}

	r.log("Stopping Redis...", "info")

	if err := r.redisProcess.Signal(syscall.SIGTERM); err != nil {
		r.redisProcess.Kill()
	}

	done := make(chan bool, 1)
	go func() {
		r.redisProcess.Wait()
		done <- true
	}()

	select {
	case <-done:
		r.log("Redis stopped", "success")
	case <-time.After(5 * time.Second):
		r.redisProcess.Kill()
		r.log("Redis forcefully killed", "warning")
	}

	r.redisProcess = nil
	return nil
}

func (r *RedisManager) IsRedisRunning() bool {
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", r.redisPort), time.Second)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

func (r *RedisManager) findAvailablePort(startPort int) int {
	for port := startPort; port < startPort+100; port++ {
		conn, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", port), 100*time.Millisecond)
		if err != nil {
			return port
		}
		conn.Close()
	}
	return startPort
}

func (r *RedisManager) GetRedisURL() string {
	return fmt.Sprintf("redis://127.0.0.1:%d/0", r.redisPort)
}

func (r *RedisManager) KillOrphanedRedisProcesses() {
	if runtime.GOOS == "windows" {
		cmd := exec.Command("taskkill", "/F", "/IM", "redis-server.exe")
		hideWindow(cmd)
		cmd.Run()
	} else {
		cmd := exec.Command("pkill", "-f", "valkey-server|redis-server")
		hideWindow(cmd)
		cmd.Run()
	}
}

func (r *RedisManager) ValkeyExists() bool {
	downloader := NewValkeyDownloader(nil)
	return downloader.ValkeyExists(r.redisDir)
}

func (r *RedisManager) DownloadValkey(progressHandler func(float64)) error {
	downloader := NewValkeyDownloader(nil)
	return downloader.DownloadValkey(r.redisDir)
}

func (r *RedisManager) GetPID() int {
	if r.redisProcess != nil {
		return r.redisProcess.Pid
	}

	cmd := exec.Command("lsof", "-ti", fmt.Sprintf(":%d", r.redisPort))
	hideWindow(cmd)
	output, err := cmd.Output()
	if err != nil {
		return 0
	}

	pid, err := strconv.Atoi(strings.TrimSpace(string(output)))
	if err != nil {
		return 0
	}

	return pid
}
