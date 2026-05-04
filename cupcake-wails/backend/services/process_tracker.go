package services

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"syscall"
	"time"

	"github.com/noatgnu/cupcake-webgui/cupcake-wails/backend/models"
)

type ProcessTracker struct {
	trackingFile string
	processes    []models.ProcessTracking
}

func NewProcessTracker(userDataPath string) *ProcessTracker {
	trackingFile := filepath.Join(userDataPath, "processes.json")

	tracker := &ProcessTracker{
		trackingFile: trackingFile,
		processes:    []models.ProcessTracking{},
	}

	tracker.loadProcesses()
	return tracker
}

func (p *ProcessTracker) loadProcesses() {
	data, err := os.ReadFile(p.trackingFile)
	if err != nil {
		return
	}

	json.Unmarshal(data, &p.processes)
}

func (p *ProcessTracker) saveProcesses() {
	data, err := json.MarshalIndent(p.processes, "", "  ")
	if err != nil {
		log.Printf("[ProcessTracker] Failed to marshal processes: %v", err)
		return
	}

	os.WriteFile(p.trackingFile, data, 0644)
}

func (p *ProcessTracker) TrackProcess(pid int, processType string) {
	tracking := models.ProcessTracking{
		PID:       pid,
		Type:      processType,
		Timestamp: time.Now(),
	}

	p.processes = append(p.processes, tracking)
	p.saveProcesses()

	log.Printf("[ProcessTracker] Tracking PID %d (%s)", pid, processType)
}

func (p *ProcessTracker) UntrackProcess(pid int) {
	var newProcesses []models.ProcessTracking
	for _, proc := range p.processes {
		if proc.PID != pid {
			newProcesses = append(newProcesses, proc)
		}
	}
	p.processes = newProcesses
	p.saveProcesses()

	log.Printf("[ProcessTracker] Untracked PID %d", pid)
}

func (p *ProcessTracker) GetTrackedProcesses() []models.ProcessTracking {
	return p.processes
}

func (p *ProcessTracker) GetProcessesByType(processType string) []models.ProcessTracking {
	var result []models.ProcessTracking
	for _, proc := range p.processes {
		if proc.Type == processType {
			result = append(result, proc)
		}
	}
	return result
}

func (p *ProcessTracker) IsProcessRunning(pid int) bool {
	process, err := os.FindProcess(pid)
	if err != nil {
		return false
	}

	err = process.Signal(syscall.Signal(0))
	return err == nil
}

func (p *ProcessTracker) KillOrphanedProcesses() int {
	killedCount := 0

	for _, proc := range p.processes {
		if p.IsProcessRunning(proc.PID) {
			process, err := os.FindProcess(proc.PID)
			if err == nil {
				log.Printf("[ProcessTracker] Killing orphaned process PID %d (%s)", proc.PID, proc.Type)
				process.Kill()
				killedCount++
			}
		}
	}

	p.processes = []models.ProcessTracking{}
	p.saveProcesses()

	return killedCount
}

func (p *ProcessTracker) Clear() {
	p.processes = []models.ProcessTracking{}
	p.saveProcesses()
}
