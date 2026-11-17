package services

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/noatgnu/cupcake-webgui/cupcake-wails/backend/models"
)

// ProcessTracker records the processes the app starts, so the ones left behind by a crash can be stopped on the
// next start without touching any other process on the computer.
type ProcessTracker struct {
	mu           sync.Mutex
	trackingFile string
	processes    []models.ProcessTracking
	describe     func(pid int) (string, error)
}

func NewProcessTracker(userDataPath string) *ProcessTracker {
	tracker := &ProcessTracker{
		trackingFile: filepath.Join(userDataPath, "processes.json"),
		processes:    []models.ProcessTracking{},
		describe:     DescribeProcess,
	}
	tracker.loadProcesses()
	return tracker
}

func (p *ProcessTracker) loadProcesses() {
	data, err := os.ReadFile(p.trackingFile)
	if err != nil {
		return
	}
	if err := json.Unmarshal(data, &p.processes); err != nil {
		log.Printf("[ProcessTracker] Ignoring unreadable %s: %v", p.trackingFile, err)
		p.processes = []models.ProcessTracking{}
	}
}

func (p *ProcessTracker) saveProcesses() {
	data, err := json.MarshalIndent(p.processes, "", "  ")
	if err != nil {
		log.Printf("[ProcessTracker] Failed to marshal processes: %v", err)
		return
	}
	if err := os.WriteFile(p.trackingFile, data, 0600); err != nil {
		log.Printf("[ProcessTracker] Failed to save %s: %v", p.trackingFile, err)
	}
}

// TrackProcess records a process the app started; marker is the path of its executable or interpreter, which,
// as given or with links resolved, must still appear in the process for it to be stopped later.
func (p *ProcessTracker) TrackProcess(pid int, processType string, marker string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.processes = append(p.processes, models.ProcessTracking{
		PID:       pid,
		Type:      processType,
		Marker:    marker,
		Timestamp: time.Now(),
	})
	p.saveProcesses()
	log.Printf("[ProcessTracker] Tracking PID %d (%s)", pid, processType)
}

func (p *ProcessTracker) UntrackProcess(pid int) {
	p.mu.Lock()
	defer p.mu.Unlock()
	var kept []models.ProcessTracking
	for _, proc := range p.processes {
		if proc.PID != pid {
			kept = append(kept, proc)
		}
	}
	p.processes = kept
	p.saveProcesses()
}

func (p *ProcessTracker) GetTrackedProcesses() []models.ProcessTracking {
	p.mu.Lock()
	defer p.mu.Unlock()
	return append([]models.ProcessTracking(nil), p.processes...)
}

// IsOwnProcess reports whether pid is running and is still the process that was recorded with marker.
func (p *ProcessTracker) IsOwnProcess(pid int, marker string) bool {
	if pid <= 0 || marker == "" {
		return false
	}
	description, err := p.describe(pid)
	if err != nil {
		return false
	}
	return DescriptionMatches(description, marker) || DescriptionMatches(description, ProcessMarker(marker))
}

// KillOrphanedProcesses stops the recorded processes that are still running as the processes the app started,
// forgets every record, and returns how many were stopped.
func (p *ProcessTracker) KillOrphanedProcesses() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	killed := 0
	for _, proc := range p.processes {
		if !p.IsOwnProcess(proc.PID, proc.Marker) {
			continue
		}
		process, err := os.FindProcess(proc.PID)
		if err != nil {
			continue
		}
		log.Printf("[ProcessTracker] Stopping leftover %s (PID %d)", proc.Type, proc.PID)
		if err := process.Kill(); err == nil {
			killed++
		}
	}
	p.processes = []models.ProcessTracking{}
	p.saveProcesses()
	return killed
}

func (p *ProcessTracker) Clear() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.processes = []models.ProcessTracking{}
	p.saveProcesses()
}
