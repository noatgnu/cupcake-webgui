package services

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type LogHandler struct {
	logDir      string
	currentFile *os.File
	currentDate string
}

func NewLogHandler(userDataPath string) *LogHandler {
	logDir := filepath.Join(userDataPath, "logs")
	os.MkdirAll(logDir, 0755)

	handler := &LogHandler{
		logDir: logDir,
	}

	handler.rotateLogFile()
	go handler.cleanOldLogs(30)

	return handler
}

func (h *LogHandler) rotateLogFile() {
	today := time.Now().Format("2006-01-02")

	if h.currentDate == today && h.currentFile != nil {
		return
	}

	if h.currentFile != nil {
		h.currentFile.Close()
	}

	logFileName := fmt.Sprintf("backend-%s.log", today)
	logFilePath := filepath.Join(h.logDir, logFileName)

	file, err := os.OpenFile(logFilePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		log.Printf("[LogHandler] Failed to open log file: %v", err)
		return
	}

	h.currentFile = file
	h.currentDate = today
}

func (h *LogHandler) WriteLog(message, msgType string) {
	h.rotateLogFile()

	if h.currentFile == nil {
		return
	}

	timestamp := time.Now().Format("2006-01-02 15:04:05")
	logLine := fmt.Sprintf("[%s] [%s] %s\n", timestamp, strings.ToUpper(msgType), message)

	h.currentFile.WriteString(logLine)
}

func (h *LogHandler) cleanOldLogs(maxDays int) {
	files, err := os.ReadDir(h.logDir)
	if err != nil {
		return
	}

	cutoffDate := time.Now().AddDate(0, 0, -maxDays)

	for _, file := range files {
		if file.IsDir() {
			continue
		}

		name := file.Name()
		if !strings.HasPrefix(name, "backend-") || !strings.HasSuffix(name, ".log") {
			continue
		}

		dateStr := strings.TrimPrefix(strings.TrimSuffix(name, ".log"), "backend-")
		fileDate, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			continue
		}

		if fileDate.Before(cutoffDate) {
			os.Remove(filepath.Join(h.logDir, name))
			log.Printf("[LogHandler] Removed old log file: %s", name)
		}
	}
}

func (h *LogHandler) GetLogFiles() []string {
	files, err := os.ReadDir(h.logDir)
	if err != nil {
		return nil
	}

	var logFiles []string
	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".log") {
			logFiles = append(logFiles, file.Name())
		}
	}

	sort.Sort(sort.Reverse(sort.StringSlice(logFiles)))
	return logFiles
}

func (h *LogHandler) GetLogContent(filename string) (string, error) {
	logPath := filepath.Join(h.logDir, filename)
	content, err := os.ReadFile(logPath)
	if err != nil {
		return "", err
	}
	return string(content), nil
}

func (h *LogHandler) Close() {
	if h.currentFile != nil {
		h.currentFile.Close()
	}
}
