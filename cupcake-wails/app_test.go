package main

import (
	"testing"
	"time"

	"github.com/noatgnu/cupcake/cupcake-wails/backend/models"
	"github.com/wailsapp/wails/v3/pkg/application"
)

func TestAppInitialization(t *testing.T) {
	app := NewApp()

	if app == nil {
		t.Fatal("NewApp() returned nil")
	}

	if app.userDataPath == "" {
		t.Error("userDataPath should not be empty")
	}
}

func TestSetApplication(t *testing.T) {
	app := NewApp()

	if app.wailsApp != nil {
		t.Error("wailsApp should be nil initially")
	}

	wailsApp := application.New(application.Options{
		Name: "Test App",
	})

	app.SetApplication(wailsApp)

	if app.wailsApp == nil {
		t.Error("wailsApp should not be nil after SetApplication")
	}
}

func TestEventEmission(t *testing.T) {
	app := NewApp()

	wailsApp := application.New(application.Options{
		Name: "Test App",
	})
	app.SetApplication(wailsApp)

	eventReceived := make(chan bool, 1)
	var receivedStatus models.BackendStatus

	wailsApp.Event.On("backend:status", func(event *application.CustomEvent) {
		if data, ok := event.Data.(models.BackendStatus); ok {
			receivedStatus = data
			eventReceived <- true
		}
	})

	go func() {
		app.sendBackendStatus("test-service", "ready", "Test message")
	}()

	select {
	case <-eventReceived:
		if receivedStatus.Service != "test-service" {
			t.Errorf("Expected service 'test-service', got '%s'", receivedStatus.Service)
		}
		if receivedStatus.Status != "ready" {
			t.Errorf("Expected status 'ready', got '%s'", receivedStatus.Status)
		}
		if receivedStatus.Message != "Test message" {
			t.Errorf("Expected message 'Test message', got '%s'", receivedStatus.Message)
		}
	case <-time.After(2 * time.Second):
		t.Error("Timeout waiting for event - event emission failed")
	}
}

func TestLogEventEmission(t *testing.T) {
	app := NewApp()

	wailsApp := application.New(application.Options{
		Name: "Test App",
	})
	app.SetApplication(wailsApp)

	eventReceived := make(chan bool, 1)
	var receivedLog models.LogMessage

	wailsApp.Event.On("backend:log", func(event *application.CustomEvent) {
		if data, ok := event.Data.(models.LogMessage); ok {
			receivedLog = data
			eventReceived <- true
		}
	})

	go func() {
		app.sendBackendLog("Test log message", "info")
	}()

	select {
	case <-eventReceived:
		if receivedLog.Message != "Test log message" {
			t.Errorf("Expected message 'Test log message', got '%s'", receivedLog.Message)
		}
		if receivedLog.Type != "info" {
			t.Errorf("Expected type 'info', got '%s'", receivedLog.Type)
		}
	case <-time.After(2 * time.Second):
		t.Error("Timeout waiting for log event - event emission failed")
	}
}

func TestGetAppVersion(t *testing.T) {
	app := NewApp()
	version := app.GetAppVersion()

	if version != "0.0.1" {
		t.Errorf("Expected version '0.0.1', got '%s'", version)
	}
}

func TestGetBackendPort(t *testing.T) {
	app := NewApp()
	port := app.GetBackendPort()

	if port != 8000 {
		t.Errorf("Expected default port 8000, got %d", port)
	}
}

func TestIsBackendReady(t *testing.T) {
	app := NewApp()

	if app.IsBackendReady() {
		t.Error("Backend should not be ready initially")
	}
}

func TestNilWailsAppHandling(t *testing.T) {
	app := NewApp()

	defer func() {
		if r := recover(); r != nil {
			t.Errorf("sendBackendStatus panicked with nil wailsApp: %v", r)
		}
	}()

	app.sendBackendStatus("test", "ready", "message")
}

func TestTestEventEmit(t *testing.T) {
	app := NewApp()

	wailsApp := application.New(application.Options{
		Name: "Test App",
	})
	app.SetApplication(wailsApp)

	eventReceived := make(chan bool, 1)

	wailsApp.Event.On("test:ping", func(event *application.CustomEvent) {
		eventReceived <- true
	})

	go func() {
		app.TestEventEmit()
	}()

	select {
	case <-eventReceived:
		t.Log("test:ping event received successfully")
	case <-time.After(2 * time.Second):
		t.Error("Timeout waiting for test:ping event")
	}
}
