// internal/model/library.go
package model

type Library struct {
	ID        string `json:"id" db:"id"`
	Name      string `json:"name" db:"name"`
	Slug      string `json:"slug" db:"slug"`
	Icon      string `json:"icon" db:"icon"`
	Position  int    `json:"position" db:"position"`
	CreatedAt int64  `json:"created_at" db:"created_at"`
}

type Category struct {
	ID        string      `json:"id" db:"id"`
	LibraryID string      `json:"library_id" db:"library_id"`
	ParentID  *string     `json:"parent_id" db:"parent_id"`
	Name      string      `json:"name" db:"name"`
	Slug      string      `json:"slug" db:"slug"`
	Position  int         `json:"position" db:"position"`
	CreatedAt int64       `json:"created_at" db:"created_at"`
	Children  []*Category `json:"children,omitempty"`
}

type Tag struct {
	ID    string `json:"id" db:"id"`
	Name  string `json:"name" db:"name"`
	Color string `json:"color" db:"color"`
}

type Collection struct {
	ID          string `json:"id" db:"id"`
	Name        string `json:"name" db:"name"`
	Description string `json:"description" db:"description"`
	CreatedAt   int64  `json:"created_at" db:"created_at"`
}

type SavedView struct {
	ID        string `json:"id" db:"id"`
	Name      string `json:"name" db:"name"`
	Filters   string `json:"filters" db:"filters"` // raw JSON
	CreatedAt int64  `json:"created_at" db:"created_at"`
}

type Favorite struct {
	EntryID   string `json:"entry_id" db:"entry_id"`
	CreatedAt int64  `json:"created_at" db:"created_at"`
}
