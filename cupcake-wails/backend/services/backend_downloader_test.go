package services

import (
	"path/filepath"
	"testing"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
)

func TestDownloadSourceAcceptsReleaseTagsAndBranches(t *testing.T) {
	if testing.Short() {
		t.Skip("clones the backend repository from GitHub")
	}

	downloader := NewBackendDownloader(nil)
	releases, err := downloader.GetAvailableReleases()
	if err != nil || len(releases) < 2 {
		t.Skipf("need at least two published releases to test tag switching, got %d (%v)", len(releases), err)
	}
	latest, previous := releases[0].Tag, releases[1].Tag

	tagCheckout := filepath.Join(t.TempDir(), "backend")
	if err := downloader.DownloadSource(tagCheckout, latest); err != nil {
		t.Fatalf("cloning release tag %s failed: %v", latest, err)
	}
	if !downloader.BackendExists(tagCheckout) {
		t.Fatalf("expected manage.py in the %s checkout", latest)
	}
	assertHeadAtTag(t, tagCheckout, latest)

	if err := downloader.DownloadSource(tagCheckout, previous); err != nil {
		t.Fatalf("switching the existing checkout to tag %s failed: %v", previous, err)
	}
	assertHeadAtTag(t, tagCheckout, previous)

	branchCheckout := filepath.Join(t.TempDir(), "backend")
	if err := downloader.DownloadSource(branchCheckout, ""); err != nil {
		t.Fatalf("cloning the default branch failed: %v", err)
	}
	if !downloader.BackendExists(branchCheckout) {
		t.Fatal("expected manage.py in the default branch checkout")
	}
}

func assertHeadAtTag(t *testing.T, repoPath, tag string) {
	t.Helper()
	repo, err := git.PlainOpen(repoPath)
	if err != nil {
		t.Fatalf("failed to open %s: %v", repoPath, err)
	}
	head, err := repo.Head()
	if err != nil {
		t.Fatalf("failed to read HEAD: %v", err)
	}
	tagCommit, err := repo.ResolveRevision(plumbing.Revision(plumbing.NewTagReferenceName(tag).String()))
	if err != nil {
		t.Fatalf("tag %s is not present in the checkout: %v", tag, err)
	}
	if head.Hash() != *tagCommit {
		t.Errorf("expected HEAD at tag %s (%s), got %s", tag, tagCommit, head.Hash())
	}
}
