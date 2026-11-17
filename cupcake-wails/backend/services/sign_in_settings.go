package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/noatgnu/cupcake-webgui/cupcake-wails/backend/models"
)

const (
	DefaultSessionDays = 30
	MinSessionDays     = 1
	MaxSessionDays     = 90
)

// DefaultSignInSettings is the login screen with a sign-in that lasts DefaultSessionDays.
func DefaultSignInSettings() models.SignInSettings {
	return models.SignInSettings{Mode: models.SignInLogin, SessionDays: DefaultSessionDays}
}

// ValidateSignInSettings reports what is wrong with settings, or nil when they can be saved.
func ValidateSignInSettings(settings models.SignInSettings) error {
	switch settings.Mode {
	case models.SignInAutomatic:
		if settings.Username == "" {
			return fmt.Errorf("choose the account to sign in automatically")
		}
	case models.SignInLogin:
		if settings.SessionDays < MinSessionDays || settings.SessionDays > MaxSessionDays {
			return fmt.Errorf("a sign-in must last between %d and %d days", MinSessionDays, MaxSessionDays)
		}
	default:
		return fmt.Errorf("unknown sign-in mode %q", settings.Mode)
	}
	return nil
}

// SignInStore keeps the sign-in settings in the app's data folder.
type SignInStore struct {
	path string
}

func NewSignInStore(userDataPath string) *SignInStore {
	return &SignInStore{path: filepath.Join(userDataPath, "sign-in.json")}
}

// Load returns the saved settings, or the defaults when none are saved or the file cannot be read.
func (s *SignInStore) Load() models.SignInSettings {
	data, err := os.ReadFile(s.path)
	if err != nil {
		return DefaultSignInSettings()
	}
	var settings models.SignInSettings
	if err := json.Unmarshal(data, &settings); err != nil || ValidateSignInSettings(settings) != nil {
		return DefaultSignInSettings()
	}
	if settings.SessionDays == 0 {
		settings.SessionDays = DefaultSessionDays
	}
	return settings
}

// Save stores valid settings, readable only by their owner.
func (s *SignInStore) Save(settings models.SignInSettings) error {
	if settings.SessionDays == 0 {
		settings.SessionDays = DefaultSessionDays
	}
	if err := ValidateSignInSettings(settings); err != nil {
		return err
	}
	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.path, data, 0600)
}

// signInEnvironment is the backend environment for settings: in login mode a sign-in lasts exactly SessionDays and
// is not extended by use.
func signInEnvironment(settings models.SignInSettings, launcherSecret string) map[string]string {
	days := settings.SessionDays
	if days == 0 {
		days = DefaultSessionDays
	}
	rotate := "true"
	if settings.Mode == models.SignInLogin {
		rotate = "false"
	}
	return map[string]string{
		"WAILS_LAUNCHER_SECRET":       launcherSecret,
		"WAILS_REFRESH_TOKEN_DAYS":    strconv.Itoa(days),
		"WAILS_ACCESS_TOKEN_HOURS":    "24",
		"WAILS_ROTATE_REFRESH_TOKENS": rotate,
	}
}

// RequestAutomaticSignIn asks the backend at baseURL to sign in username with the launcher's secret.
func RequestAutomaticSignIn(baseURL, launcherSecret, username string) (*models.AutomaticSignIn, error) {
	body, err := json.Marshal(map[string]string{"username": username})
	if err != nil {
		return nil, err
	}
	request, err := http.NewRequest(http.MethodPost, baseURL+"/api/v1/auth/desktop-sign-in/", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Cupcake-Launcher", launcherSecret)
	response, err := (&http.Client{Timeout: 15 * time.Second}).Do(request)
	if err != nil {
		return nil, fmt.Errorf("the backend did not answer: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		var failure struct {
			Error string `json:"error"`
		}
		json.NewDecoder(response.Body).Decode(&failure)
		if failure.Error == "" {
			failure.Error = response.Status
		}
		return nil, fmt.Errorf("automatic sign-in failed: %s", failure.Error)
	}
	var signIn models.AutomaticSignIn
	if err := json.NewDecoder(response.Body).Decode(&signIn); err != nil {
		return nil, fmt.Errorf("unreadable sign-in answer: %w", err)
	}
	return &signIn, nil
}
