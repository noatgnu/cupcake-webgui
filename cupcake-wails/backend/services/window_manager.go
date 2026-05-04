package services

import (
	"log"
	"sync"
)

type WindowInfo struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	Title   string `json:"title"`
	URL     string `json:"url"`
	Width   int    `json:"width"`
	Height  int    `json:"height"`
	Visible bool   `json:"visible"`
}

type WindowManager struct {
	windows map[string]WindowInfo
	mu      sync.RWMutex
}

func NewWindowManager() *WindowManager {
	return &WindowManager{
		windows: make(map[string]WindowInfo),
	}
}

func (w *WindowManager) RegisterWindow(id, windowType, title, url string, width, height int) {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.windows[id] = WindowInfo{
		ID:      id,
		Type:    windowType,
		Title:   title,
		URL:     url,
		Width:   width,
		Height:  height,
		Visible: true,
	}

	log.Printf("[WindowManager] Registered window: %s (%s)", id, windowType)
}

func (w *WindowManager) UnregisterWindow(id string) {
	w.mu.Lock()
	defer w.mu.Unlock()

	delete(w.windows, id)
	log.Printf("[WindowManager] Unregistered window: %s", id)
}

func (w *WindowManager) GetWindow(id string) (WindowInfo, bool) {
	w.mu.RLock()
	defer w.mu.RUnlock()

	info, exists := w.windows[id]
	return info, exists
}

func (w *WindowManager) GetWindowsByType(windowType string) []WindowInfo {
	w.mu.RLock()
	defer w.mu.RUnlock()

	var result []WindowInfo
	for _, info := range w.windows {
		if info.Type == windowType {
			result = append(result, info)
		}
	}
	return result
}

func (w *WindowManager) GetAllWindows() []WindowInfo {
	w.mu.RLock()
	defer w.mu.RUnlock()

	var result []WindowInfo
	for _, info := range w.windows {
		result = append(result, info)
	}
	return result
}

func (w *WindowManager) SetWindowVisibility(id string, visible bool) {
	w.mu.Lock()
	defer w.mu.Unlock()

	if info, exists := w.windows[id]; exists {
		info.Visible = visible
		w.windows[id] = info
	}
}

func (w *WindowManager) HasWindow(id string) bool {
	w.mu.RLock()
	defer w.mu.RUnlock()

	_, exists := w.windows[id]
	return exists
}
