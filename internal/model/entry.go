// internal/model/entry.go
package model

type Root struct {
	ID        string `json:"id" db:"id"`
	Path      string `json:"path" db:"path"`
	Label     string `json:"label" db:"label"`
	CreatedAt int64  `json:"created_at" db:"created_at"`
}

type Entry struct {
	ID            string `json:"id" db:"id"`
	RootID        string `json:"root_id" db:"root_id"`
	RelPath       string `json:"rel_path" db:"rel_path"`
	ParentRelPath string `json:"parent_rel_path" db:"parent_rel_path"`
	Name          string `json:"name" db:"name"`
	Kind          string `json:"kind" db:"kind"` // "file" | "dir"
	Size          *int64 `json:"size" db:"size"`
	Mtime         int64  `json:"mtime" db:"mtime"`
	Ext           string `json:"ext" db:"ext"`
	Mime          string `json:"mime" db:"mime"`
	Missing       bool   `json:"missing" db:"missing"`
	UpdatedAt     int64  `json:"updated_at" db:"updated_at"`
}

// EntryDetail is Entry plus logical metadata, returned by GET /api/entries/:id
type EntryDetail struct {
	Entry
	Categories  []Category     `json:"categories"`
	Tags        []Tag          `json:"tags"`
	Collections []CollectionRef `json:"collections"`
	Favorited   bool           `json:"favorited"`
}

type CollectionRef struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}
