package services

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestLocalPackageTargetsUsesBundledPackages(t *testing.T) {
	backendDir := t.TempDir()
	for _, name := range []string{"choux", "cupcake-protocols-io"} {
		dir := filepath.Join(backendDir, "packages", name)
		if err := os.MkdirAll(dir, 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, "pyproject.toml"), []byte("[project]\n"), 0644); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.MkdirAll(filepath.Join(backendDir, "packages", "not-a-project"), 0755); err != nil {
		t.Fatal(err)
	}

	requirementsPath := filepath.Join(backendDir, "requirements.txt")
	requirements := "-e file:///mnt/d/PycharmProjects/cupcake_vanilla/packages/choux ; python_version >= \"3.12\"\n" +
		"-e file:///D:/PycharmProjects/cupcake_vanilla/packages/cupcake-protocols-io ; python_version >= \"3.12\"\n" +
		"django==5.2.7 ; python_version >= \"3.12\"\n" +
		"six==1.17.0\n"
	if err := os.WriteFile(requirementsPath, []byte(requirements), 0644); err != nil {
		t.Fatal(err)
	}

	targets, cleanup, err := localPackageTargets(requirementsPath)
	if err != nil {
		t.Fatalf("localPackageTargets failed: %v", err)
	}
	filteredPath := targets[1]

	expected := []string{
		"-r", filteredPath,
		filepath.Join(backendDir, "packages", "choux"),
		filepath.Join(backendDir, "packages", "cupcake-protocols-io"),
	}
	if !reflect.DeepEqual(targets, expected) {
		t.Errorf("expected targets %v, got %v", expected, targets)
	}

	filtered, err := os.ReadFile(filteredPath)
	if err != nil {
		t.Fatalf("filtered requirements missing: %v", err)
	}
	want := "django==5.2.7 ; python_version >= \"3.12\"\nsix==1.17.0\n"
	if string(filtered) != want {
		t.Errorf("expected filtered requirements %q, got %q", want, string(filtered))
	}

	cleanup()
	if _, err := os.Stat(filteredPath); !os.IsNotExist(err) {
		t.Errorf("expected cleanup to remove %s", filteredPath)
	}
}
