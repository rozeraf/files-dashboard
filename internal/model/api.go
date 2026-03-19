// internal/model/api.go
package model

import "sync"

// --- Roots ---
type CreateRootRequest struct {
	Path  string `json:"path"`
	Label string `json:"label"`
}
type UpdateRootRequest struct {
	Label string `json:"label"`
}

// --- Libraries ---
type CreateLibraryRequest struct {
	Name string `json:"name"`
	Icon string `json:"icon"`
}
type UpdateLibraryRequest struct {
	Name     *string `json:"name"`
	Icon     *string `json:"icon"`
	Position *int    `json:"position"`
}

// --- Categories ---
type CreateCategoryRequest struct {
	LibraryID string  `json:"libraryId"`
	ParentID  *string `json:"parentId"`
	Name      string  `json:"name"`
}
type UpdateCategoryRequest struct {
	Name     *string `json:"name"`
	ParentID *string `json:"parentId"`
	Position *int    `json:"position"`
}

// --- Tags ---
type CreateTagRequest struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}
type UpdateTagRequest struct {
	Name  *string `json:"name"`
	Color *string `json:"color"`
}
type DeltaTagsRequest struct {
	Add    []string `json:"add"`
	Remove []string `json:"remove"`
}

// --- Categories assignment ---
type DeltaCategoriesRequest struct {
	Add    []string `json:"add"`
	Remove []string `json:"remove"`
}

// --- Collections ---
type CreateCollectionRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}
type UpdateCollectionRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
}
type AddToCollectionRequest struct {
	EntryID string `json:"entryId"`
}
type ReorderCollectionRequest struct {
	Order []string `json:"order"`
}

// --- Saved views ---
type CreateSavedViewRequest struct {
	Name    string         `json:"name"`
	Filters map[string]any `json:"filters"`
}
type UpdateSavedViewRequest struct {
	Name    *string        `json:"name"`
	Filters map[string]any `json:"filters"`
}

// --- FS ---
type CreateDirectoryRequest struct {
	RootID  string `json:"rootId"`
	RelPath string `json:"relPath"`
	Name    string `json:"name"`
}
type RenameRequest struct {
	Name string `json:"name"`
}
type MoveRequest struct {
	IDs         []string `json:"ids"`
	DestRootID  string   `json:"destRootId"`
	DestRelPath string   `json:"destRelPath"`
}
type DeleteRequest struct {
	IDs []string `json:"ids"`
}

// --- Config ---
type UpdateConfigRequest struct {
	AppName *string `json:"app_name"`
	Host    *string `json:"host"`
	Port    *int    `json:"port"`
}
type UpdateConfigResponse struct {
	RestartRequired bool `json:"restart_required"`
}
type RootRef struct {
	ID    string `json:"id"`
	Path  string `json:"path"`
	Label string `json:"label"`
}
type ConfigResponse struct {
	Host       string    `json:"host"`
	Port       int       `json:"port"`
	AppName    string    `json:"app_name"`
	LanEnabled bool      `json:"lan_enabled"`
	Roots      []RootRef `json:"roots"`
}

// --- Scan ---
type ScanJobResponse struct {
	mu      sync.Mutex `json:"-"`
	JobID   string     `json:"jobId"`
	Status  string     `json:"status"`  // "running" | "done" | "error"
	Scanned int        `json:"scanned"`
	Added   int        `json:"added"`
	Removed int        `json:"removed"`
	Error   string     `json:"error,omitempty"`
}

func (j *ScanJobResponse) Lock()   { j.mu.Lock() }
func (j *ScanJobResponse) Unlock() { j.mu.Unlock() }

// --- Pagination ---
type PagedResponse[T any] struct {
	Items []T `json:"items"`
	Total int `json:"total"`
	Page  int `json:"page"`
	Limit int `json:"limit"`
}
