package services

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestGitHubRequestsCarryTheTokenWhenOneIsSet(t *testing.T) {
	var authorization, agent string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authorization = r.Header.Get("Authorization")
		agent = r.Header.Get("User-Agent")
		w.Write([]byte("[]"))
	}))
	defer server.Close()

	t.Setenv("GITHUB_TOKEN", "ci-token")
	resp, err := githubAPIGet(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if authorization != "Bearer ci-token" {
		t.Fatalf("Authorization = %q", authorization)
	}
	if agent == "" {
		t.Fatal("no User-Agent was sent")
	}

	t.Setenv("GITHUB_TOKEN", "")
	resp, err = githubAPIGet(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if authorization != "" {
		t.Fatalf("a token was sent without GITHUB_TOKEN: %q", authorization)
	}
}

func TestGitHubRefusalsNameTheReason(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{"message": "API rate limit exceeded for 203.0.113.7."})
	}))
	defer server.Close()

	_, err := githubAPIGet(server.URL)
	if err == nil || !strings.Contains(err.Error(), "403") || !strings.Contains(err.Error(), "rate limit exceeded") {
		t.Fatalf("error = %v", err)
	}
}
