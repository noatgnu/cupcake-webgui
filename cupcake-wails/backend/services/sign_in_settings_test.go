package services

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/noatgnu/cupcake-webgui/cupcake-wails/backend/models"
)

func TestSignInDefaultsToTheLoginScreenForThirtyDays(t *testing.T) {
	settings := NewSignInStore(t.TempDir()).Load()
	if settings.Mode != models.SignInLogin || settings.SessionDays != 30 {
		t.Fatalf("default settings = %+v", settings)
	}
}

func TestSignInSettingsAreSavedAndReadBack(t *testing.T) {
	folder := t.TempDir()
	store := NewSignInStore(folder)
	want := models.SignInSettings{Mode: models.SignInAutomatic, Username: "bench-owner", SessionDays: 7}
	if err := store.Save(want); err != nil {
		t.Fatal(err)
	}
	if got := NewSignInStore(folder).Load(); got != want {
		t.Fatalf("read back %+v, want %+v", got, want)
	}
	info, err := os.Stat(filepath.Join(folder, "sign-in.json"))
	if err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS != "windows" && info.Mode().Perm() != 0600 {
		t.Fatalf("sign-in.json mode = %v, want 0600", info.Mode().Perm())
	}
}

func TestInvalidSignInSettingsAreRefused(t *testing.T) {
	cases := map[string]models.SignInSettings{
		"automatic without an account":  {Mode: models.SignInAutomatic},
		"a sign-in shorter than a day":  {Mode: models.SignInLogin, SessionDays: -1},
		"a sign-in longer than 90 days": {Mode: models.SignInLogin, SessionDays: 91},
		"an unknown mode":               {Mode: "fingerprint", SessionDays: 7},
	}
	for name, settings := range cases {
		if err := NewSignInStore(t.TempDir()).Save(settings); err == nil {
			t.Errorf("%s was saved", name)
		}
	}
}

func TestADamagedSettingsFileFallsBackToTheLoginScreen(t *testing.T) {
	folder := t.TempDir()
	os.WriteFile(filepath.Join(folder, "sign-in.json"), []byte(`{"mode":"automatic","username":""}`), 0600)
	if settings := NewSignInStore(folder).Load(); settings != DefaultSignInSettings() {
		t.Fatalf("settings = %+v, want the defaults", settings)
	}
}

func TestTheLoginScreenGivesSignInsAFixedLength(t *testing.T) {
	env := signInEnvironment(models.SignInSettings{Mode: models.SignInLogin, SessionDays: 7}, "secret")
	if env["WAILS_REFRESH_TOKEN_DAYS"] != "7" || env["WAILS_ROTATE_REFRESH_TOKENS"] != "false" {
		t.Fatalf("login environment = %v", env)
	}
	if env["WAILS_LAUNCHER_SECRET"] != "secret" {
		t.Fatal("the launcher secret is not passed to the backend")
	}
	automatic := signInEnvironment(models.SignInSettings{Mode: models.SignInAutomatic, Username: "a"}, "secret")
	if automatic["WAILS_ROTATE_REFRESH_TOKENS"] != "true" || automatic["WAILS_REFRESH_TOKEN_DAYS"] != "30" {
		t.Fatalf("automatic environment = %v", automatic)
	}
}

func TestTheBackendEnvironmentCarriesSignInAndNoFixedKey(t *testing.T) {
	manager := NewBackendManager(t.TempDir(), false, NewRedisManager(RedisManagerOptions{UserDataPath: t.TempDir()}))
	manager.SetSignInSettings(models.SignInSettings{Mode: models.SignInLogin, SessionDays: 3})
	env := strings.Join(manager.getBackendEnv(t.TempDir()), "\n")
	for _, want := range []string{"WAILS_REFRESH_TOKEN_DAYS=3", "WAILS_ROTATE_REFRESH_TOKENS=false", "WAILS_LAUNCHER_SECRET=" + manager.LauncherSecret()} {
		if !strings.Contains(env, want) {
			t.Errorf("environment lacks %s", want)
		}
	}
	for _, unwanted := range []string{"\nSECRET_KEY=development", "DATABASE_URL=sqlite"} {
		if strings.Contains("\n"+env, unwanted) {
			t.Errorf("environment still sets %s", unwanted)
		}
	}
	if len(manager.LauncherSecret()) != 64 {
		t.Fatalf("launcher secret has %d characters, want 64", len(manager.LauncherSecret()))
	}
	if NewBackendManager(t.TempDir(), false, nil).LauncherSecret() == manager.LauncherSecret() {
		t.Fatal("two launches share a launcher secret")
	}
}

func TestRequestAutomaticSignInSendsTheSecretAndReturnsTokens(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/auth/desktop-sign-in/" || r.Header.Get("X-Cupcake-Launcher") != "secret" {
			w.WriteHeader(http.StatusForbidden)
			json.NewEncoder(w).Encode(map[string]string{"error": "Invalid launcher secret"})
			return
		}
		var body map[string]string
		json.NewDecoder(r.Body).Decode(&body)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"access_token":  "access",
			"refresh_token": "refresh",
			"user":          map[string]interface{}{"username": body["username"]},
		})
	}))
	defer server.Close()

	signIn, err := RequestAutomaticSignIn(server.URL, "secret", "bench-owner")
	if err != nil {
		t.Fatal(err)
	}
	if signIn.AccessToken != "access" || signIn.RefreshToken != "refresh" || signIn.User["username"] != "bench-owner" {
		t.Fatalf("sign-in = %+v", signIn)
	}
	if _, err := RequestAutomaticSignIn(server.URL, "wrong", "bench-owner"); err == nil || !strings.Contains(err.Error(), "Invalid launcher secret") {
		t.Fatalf("a refused sign-in returned %v", err)
	}
}

func TestRequestAutomaticSignInReportsAnUnreachableBackend(t *testing.T) {
	server := httptest.NewServer(http.NotFoundHandler())
	url := server.URL
	server.Close()
	if _, err := RequestAutomaticSignIn(url, "secret", "bench-owner"); err == nil {
		t.Fatal("an unreachable backend gave no error")
	}
}
