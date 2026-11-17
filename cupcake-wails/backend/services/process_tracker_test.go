package services

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
	"time"
)

func startSleeper(t *testing.T) *exec.Cmd {
	t.Helper()
	if runtime.GOOS == "windows" {
		t.Skip("uses the POSIX sleep command")
	}
	cmd := exec.Command(sleepPath(t), "30")
	if err := cmd.Start(); err != nil {
		t.Fatalf("starting sleep: %v", err)
	}
	t.Cleanup(func() {
		cmd.Process.Kill()
		cmd.Wait()
	})
	return cmd
}

func waitForExit(cmd *exec.Cmd) bool {
	done := make(chan struct{})
	go func() {
		cmd.Wait()
		close(done)
	}()
	select {
	case <-done:
		return true
	case <-time.After(3 * time.Second):
		return false
	}
}

func sleepPath(t *testing.T) string {
	t.Helper()
	path, err := exec.LookPath("sleep")
	if err != nil {
		t.Skip("sleep is not available")
	}
	return path
}

func TestKillOrphanedProcessesStopsOnlyMatchingRecords(t *testing.T) {
	tracker := NewProcessTracker(t.TempDir())
	ours := startSleeper(t)
	stranger := startSleeper(t)
	tracker.TrackProcess(ours.Process.Pid, "django", sleepPath(t))
	tracker.TrackProcess(stranger.Process.Pid, "redis", "/opt/not-the-app/redis-server")

	if stopped := tracker.KillOrphanedProcesses(); stopped != 1 {
		t.Fatalf("stopped %d processes, want 1", stopped)
	}
	if !waitForExit(ours) {
		t.Fatal("the recorded process that still matches was not stopped")
	}
	if !tracker.IsOwnProcess(stranger.Process.Pid, sleepPath(t)) {
		t.Fatal("a process whose path does not match was stopped")
	}
	if len(tracker.GetTrackedProcesses()) != 0 {
		t.Fatal("records were kept after cleaning up")
	}
}

func TestKillOrphanedProcessesSkipsProcessesThatEnded(t *testing.T) {
	tracker := NewProcessTracker(t.TempDir())
	ended := startSleeper(t)
	pid := ended.Process.Pid
	ended.Process.Kill()
	ended.Wait()
	tracker.TrackProcess(pid, "rqworker", sleepPath(t))

	if stopped := tracker.KillOrphanedProcesses(); stopped != 0 {
		t.Fatalf("stopped %d processes, want 0", stopped)
	}
}

func TestRecordsSurviveARestartOfTheApp(t *testing.T) {
	folder := t.TempDir()
	first := NewProcessTracker(folder)
	first.TrackProcess(4242, "redis", "/opt/cupcake/redis/valkey-server")
	first.TrackProcess(4343, "django", "/opt/cupcake/backend/python/bin/python3")
	first.UntrackProcess(4343)

	second := NewProcessTracker(folder)
	records := second.GetTrackedProcesses()
	if len(records) != 1 || records[0].PID != 4242 || records[0].Marker != "/opt/cupcake/redis/valkey-server" {
		t.Fatalf("records after restart = %+v", records)
	}
	info, err := os.Stat(filepath.Join(folder, "processes.json"))
	if err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS != "windows" && info.Mode().Perm() != 0600 {
		t.Fatalf("processes.json mode = %v, want 0600", info.Mode().Perm())
	}
}

func TestAnUnreadableRecordFileIsIgnored(t *testing.T) {
	folder := t.TempDir()
	os.WriteFile(filepath.Join(folder, "processes.json"), []byte("{not json"), 0600)
	if records := NewProcessTracker(folder).GetTrackedProcesses(); len(records) != 0 {
		t.Fatalf("records = %+v, want none", records)
	}
}

func TestIsOwnProcessMatchesThePathWithLinksResolved(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symbolic links need extra rights on Windows")
	}
	link := filepath.Join(t.TempDir(), "python3")
	if err := os.Symlink(sleepPath(t), link); err != nil {
		t.Fatal(err)
	}
	cmd := exec.Command(link, "30")
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() {
		cmd.Process.Kill()
		cmd.Wait()
	}()
	tracker := NewProcessTracker(t.TempDir())
	if !tracker.IsOwnProcess(cmd.Process.Pid, link) {
		t.Fatal("a process started through a link was not recognised")
	}
	if tracker.IsOwnProcess(cmd.Process.Pid, "") {
		t.Fatal("an empty marker matched")
	}
}

func TestDescribeProcessFailsForAProcessThatIsNotRunning(t *testing.T) {
	ended := startSleeper(t)
	pid := ended.Process.Pid
	ended.Process.Kill()
	ended.Wait()
	if _, err := DescribeProcess(pid); err == nil {
		t.Fatal("a process that ended was described")
	}
}
