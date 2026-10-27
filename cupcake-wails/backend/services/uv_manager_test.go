package services

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestUvReleaseAsset(t *testing.T) {
	cases := map[[2]string]string{
		{"linux", "amd64"}:   "uv-x86_64-unknown-linux-gnu.tar.gz",
		{"linux", "arm64"}:   "uv-aarch64-unknown-linux-gnu.tar.gz",
		{"darwin", "amd64"}:  "uv-x86_64-apple-darwin.tar.gz",
		{"darwin", "arm64"}:  "uv-aarch64-apple-darwin.tar.gz",
		{"windows", "amd64"}: "uv-x86_64-pc-windows-msvc.zip",
		{"windows", "arm64"}: "uv-aarch64-pc-windows-msvc.zip",
	}
	for platform, want := range cases {
		got, err := UvReleaseAsset(platform[0], platform[1])
		if err != nil {
			t.Errorf("%s/%s: unexpected error %v", platform[0], platform[1], err)
			continue
		}
		if got != want {
			t.Errorf("%s/%s: expected %s, got %s", platform[0], platform[1], want, got)
		}
	}

	if _, err := UvReleaseAsset("plan9", "386"); err == nil {
		t.Error("expected an error for an unsupported platform")
	}
}

func TestIsUvManagedPythonPath(t *testing.T) {
	if version, ok := IsUvManagedPythonPath("uv:3.13"); !ok || version != "3.13" {
		t.Errorf("expected uv:3.13 to be managed with version 3.13, got %q %v", version, ok)
	}
	if version, ok := IsUvManagedPythonPath("uv:"); !ok || version != ManagedPythonVersion {
		t.Errorf("expected bare uv: to default to %s, got %q %v", ManagedPythonVersion, version, ok)
	}
	if _, ok := IsUvManagedPythonPath("/usr/bin/python3"); ok {
		t.Error("expected a filesystem path not to be treated as uv-managed")
	}
}

func TestResolveUvPathPrefersManagedBinary(t *testing.T) {
	t.Setenv("PATH", "")
	manager := NewUvManager(t.TempDir())

	if _, err := manager.ResolveUvPath(); err == nil {
		t.Fatal("expected an error when neither a managed nor a system uv exists")
	}
	if manager.IsAvailable() {
		t.Fatal("expected uv to be unavailable")
	}

	managed := manager.ManagedUvPath()
	if err := os.MkdirAll(filepath.Dir(managed), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(managed, []byte("stub"), 0755); err != nil {
		t.Fatal(err)
	}

	got, err := manager.ResolveUvPath()
	if err != nil {
		t.Fatalf("expected the managed binary to resolve, got %v", err)
	}
	if got != managed {
		t.Errorf("expected %s, got %s", managed, got)
	}
}

func TestExtractNamedFileFromNestedTarGz(t *testing.T) {
	dir := t.TempDir()
	archive := filepath.Join(dir, "uv.tar.gz")
	writeTarGz(t, archive, map[string]string{
		"uv-x86_64-unknown-linux-gnu/uvx": "other",
		"uv-x86_64-unknown-linux-gnu/uv":  "uv-binary",
	})

	dest := filepath.Join(dir, "out", "uv")
	if err := os.MkdirAll(filepath.Dir(dest), 0755); err != nil {
		t.Fatal(err)
	}
	if err := extractNamedFile(archive, "uv", dest); err != nil {
		t.Fatalf("extraction failed: %v", err)
	}
	assertFileContent(t, dest, "uv-binary")
	if runtime.GOOS != "windows" {
		info, err := os.Stat(dest)
		if err != nil {
			t.Fatal(err)
		}
		if info.Mode()&0111 == 0 {
			t.Error("expected the extracted binary to be executable")
		}
	}
}

func TestExtractNamedFileFromFlatZip(t *testing.T) {
	dir := t.TempDir()
	archive := filepath.Join(dir, "uv.zip")
	writeZip(t, archive, map[string]string{
		"uvx.exe": "other",
		"uv.exe":  "uv-binary",
	})

	dest := filepath.Join(dir, "uv.exe")
	if err := extractNamedFile(archive, "uv.exe", dest); err != nil {
		t.Fatalf("extraction failed: %v", err)
	}
	assertFileContent(t, dest, "uv-binary")
}

func TestExtractNamedFileMissing(t *testing.T) {
	dir := t.TempDir()
	archive := filepath.Join(dir, "uv.tar.gz")
	writeTarGz(t, archive, map[string]string{"README.md": "docs"})

	if err := extractNamedFile(archive, "uv", filepath.Join(dir, "uv")); err == nil {
		t.Error("expected an error when the archive has no uv binary")
	}
}

func TestDetectPythonCandidatesListsManagedFirst(t *testing.T) {
	manager := NewPythonManager(t.TempDir())
	candidates := manager.DetectPythonCandidates()

	if len(candidates) == 0 {
		t.Fatal("expected at least the uv-managed candidate")
	}
	first := candidates[0]
	if !first.Managed || first.Path != UvManagedPythonPrefix+ManagedPythonVersion || first.Version != ManagedPythonVersion {
		t.Errorf("expected the uv-managed %s candidate first, got %+v", ManagedPythonVersion, first)
	}
	for _, candidate := range candidates[1:] {
		if candidate.Managed {
			t.Errorf("expected only one managed candidate, also got %+v", candidate)
		}
	}
}

func TestVerifyPythonAcceptsUvManagedPath(t *testing.T) {
	manager := NewPythonManager(t.TempDir())
	result := manager.VerifyPython(UvManagedPythonPrefix + ManagedPythonVersion)
	if !result.Valid || result.Version != ManagedPythonVersion {
		t.Errorf("expected the uv-managed path to be valid, got %+v", result)
	}
}

func TestResolvePythonLeavesSystemPathsUnchanged(t *testing.T) {
	manager := NewPythonManager(t.TempDir())
	got, err := manager.ResolvePython("/usr/bin/python3")
	if err != nil || got != "/usr/bin/python3" {
		t.Errorf("expected the path back unchanged, got %q %v", got, err)
	}
}

func TestUvProvisionsPythonVenvAndRequirements(t *testing.T) {
	if testing.Short() {
		t.Skip("downloads uv, a Python interpreter and a package from the network")
	}

	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("XDG_BIN_HOME", "")
	t.Setenv("XDG_DATA_HOME", "")

	dataDir := t.TempDir()
	manager := NewPythonManager(dataDir)

	if err := manager.Uv().DownloadUv(); err != nil {
		t.Fatalf("uv download failed: %v", err)
	}
	if _, err := os.Stat(manager.Uv().ManagedUvPath()); err != nil {
		t.Fatalf("managed uv binary missing: %v", err)
	}

	venvPython, err := manager.CreateVirtualEnvironment(UvManagedPythonPrefix + ManagedPythonVersion)
	if err != nil {
		t.Fatalf("virtual environment creation failed: %v", err)
	}
	result := manager.VerifyPython(venvPython)
	if !result.Valid {
		t.Fatalf("venv interpreter is not usable: %+v", result)
	}
	if result.Version[:len(ManagedPythonVersion)] != ManagedPythonVersion {
		t.Errorf("expected Python %s in the venv, got %s", ManagedPythonVersion, result.Version)
	}

	interpreterDir := filepath.Join(dataDir, "uv", "python")
	if entries, err := os.ReadDir(interpreterDir); err != nil || len(entries) == 0 {
		t.Errorf("expected uv to install the interpreter under %s", interpreterDir)
	}
	if entries, err := os.ReadDir(filepath.Join(home, ".local", "bin")); err == nil && len(entries) > 0 {
		t.Errorf("expected no Python launchers in the user's bin directory, found %d entries", len(entries))
	}

	requirements := filepath.Join(dataDir, "requirements.txt")
	if err := os.WriteFile(requirements, []byte("six==1.17.0\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := manager.InstallDependencies(venvPython, requirements); err != nil {
		t.Fatalf("dependency installation failed: %v", err)
	}

	packages, err := manager.GetPipList(venvPython)
	if err != nil {
		t.Fatalf("pip list failed in the uv-created venv: %v", err)
	}
	found := false
	for _, pkg := range packages {
		if pkg == "six==1.17.0" {
			found = true
		}
	}
	if !found {
		t.Errorf("expected six==1.17.0 to be installed, got %v", packages)
	}
}

func writeTarGz(t *testing.T, archivePath string, files map[string]string) {
	t.Helper()
	out, err := os.Create(archivePath)
	if err != nil {
		t.Fatal(err)
	}
	defer out.Close()

	gzw := gzip.NewWriter(out)
	defer gzw.Close()
	tw := tar.NewWriter(gzw)
	defer tw.Close()

	for name, content := range files {
		header := &tar.Header{Name: name, Mode: 0755, Size: int64(len(content)), Typeflag: tar.TypeReg}
		if err := tw.WriteHeader(header); err != nil {
			t.Fatal(err)
		}
		if _, err := tw.Write([]byte(content)); err != nil {
			t.Fatal(err)
		}
	}
}

func writeZip(t *testing.T, archivePath string, files map[string]string) {
	t.Helper()
	out, err := os.Create(archivePath)
	if err != nil {
		t.Fatal(err)
	}
	defer out.Close()

	zw := zip.NewWriter(out)
	defer zw.Close()
	for name, content := range files {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := w.Write([]byte(content)); err != nil {
			t.Fatal(err)
		}
	}
}

func assertFileContent(t *testing.T, path, want string) {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("failed to read %s: %v", path, err)
	}
	if string(data) != want {
		t.Errorf("expected %q in %s, got %q", want, path, string(data))
	}
}
