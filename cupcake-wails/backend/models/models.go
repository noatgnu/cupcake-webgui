package models

import (
	"time"

	"gorm.io/gorm"
)

type Config struct {
	gorm.Model
	Key   string `gorm:"uniqueIndex" json:"key"`
	Value string `json:"value"`
}

type PythonConfig struct {
	PythonPath       string           `json:"pythonPath"`
	PythonVersion    string           `json:"pythonVersion"`
	VenvPath         string           `json:"venvPath"`
	DistributionType DistributionType `json:"distributionType"`
	BackendSource    BackendSource    `json:"backendSource"`
}

type DistributionType string

const (
	DistributionNative   DistributionType = "native"
	DistributionPortable DistributionType = "portable"
)

type BackendSource string

const (
	BackendSourceRelease BackendSource = "release"
	BackendSourceGit     BackendSource = "git"
)

type PythonCandidate struct {
	Command string `json:"command"`
	Version string `json:"version"`
	Path    string `json:"path"`
}

type ValidationResult struct {
	Valid   bool   `json:"valid"`
	Message string `json:"message,omitempty"`
	Version string `json:"version,omitempty"`
}

type BackendStatus struct {
	Service string `json:"service"`
	Status  string `json:"status"`
	Message string `json:"message"`
}

type LogMessage struct {
	Message string `json:"message"`
	Type    string `json:"type"`
}

type DownloadProgress struct {
	Downloaded int64   `json:"downloaded"`
	Total      int64   `json:"total"`
	Percentage int     `json:"percentage"`
	Speed      float64 `json:"speed"`
}

type DownloadStatus struct {
	Message string `json:"message"`
	Type    string `json:"type"`
}

type DownloadComplete struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type ReleaseInfo struct {
	Tag         string `json:"tag"`
	Name        string `json:"name"`
	PublishedAt string `json:"publishedAt"`
	HasPortable bool   `json:"hasPortable"`
}

type ProcessTracking struct {
	PID       int       `json:"pid"`
	Type      string    `json:"type"`
	Timestamp time.Time `json:"timestamp"`
}

type CommandHistory struct {
	gorm.Model
	Command   string    `json:"command"`
	Success   bool      `json:"success"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
}

type OntologyCounts struct {
	Mondo              int `json:"mondo"`
	Uberon             int `json:"uberon"`
	NCBI               int `json:"ncbi"`
	ChEBI              int `json:"chebi"`
	PSIMS              int `json:"psims"`
	Cell               int `json:"cell"`
	Species            int `json:"species"`
	Unimod             int `json:"unimod"`
	Tissue             int `json:"tissue"`
	MSVocab            int `json:"msVocab"`
	HumanDisease       int `json:"humanDisease"`
	SubcellularLoc     int `json:"subcellularLoc"`
	Total              int `json:"total"`
}

type SyncSchemasOptions struct {
	Force bool `json:"force"`
}

type LoadColumnTemplatesOptions struct {
	Clear bool `json:"clear"`
}

type LoadOntologiesOptions struct {
	NoLimit bool     `json:"noLimit"`
	Limit   int      `json:"limit"`
	Types   []string `json:"types"`
}

type LoadSpeciesOptions struct {
	File string `json:"file,omitempty"`
}

type LoadMSModOptions struct {
	ClearExisting bool `json:"clearExisting"`
}

type LoadTissueOptions struct {
	File string `json:"file,omitempty"`
}

type LoadMSTermOptions struct {
	ClearExisting bool `json:"clearExisting"`
}

type LoadHumanDiseaseOptions struct {
	File string `json:"file,omitempty"`
}

type LoadSubcellularLocationOptions struct {
	File string `json:"file,omitempty"`
}

type BackupInfo struct {
	Name      string `json:"name"`
	Path      string `json:"path"`
	Size      int64  `json:"size"`
	CreatedAt string `json:"createdAt"`
	Type      string `json:"type"`
}

type UpdateInfo struct {
	UpdateAvailable bool   `json:"updateAvailable"`
	CurrentVersion  string `json:"currentVersion"`
	LatestVersion   string `json:"latestVersion"`
	LatestName      string `json:"latestName"`
	PublishedAt     string `json:"publishedAt"`
	HasPortable     bool   `json:"hasPortable"`
	Message         string `json:"message"`
}

type UpdateResult struct {
	Success         bool   `json:"success"`
	Message         string `json:"message"`
	PreviousVersion string `json:"previousVersion"`
	NewVersion      string `json:"newVersion"`
	BackupCreated   bool   `json:"backupCreated"`
}
