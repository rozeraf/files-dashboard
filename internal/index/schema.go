// internal/index/schema.go
package index

import "database/sql"

const ddl = `
CREATE TABLE IF NOT EXISTS roots (
	id         TEXT PRIMARY KEY,
	path       TEXT UNIQUE NOT NULL,
	label      TEXT NOT NULL,
	created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS entries (
	id               TEXT PRIMARY KEY,
	root_id          TEXT NOT NULL REFERENCES roots(id) ON DELETE CASCADE,
	rel_path         TEXT NOT NULL,
	parent_rel_path  TEXT NOT NULL,
	name             TEXT NOT NULL,
	kind             TEXT NOT NULL,
	size             INTEGER,
	mtime            INTEGER NOT NULL,
	ext              TEXT NOT NULL DEFAULT '',
	mime             TEXT NOT NULL DEFAULT '',
	missing          INTEGER NOT NULL DEFAULT 0,
	updated_at       INTEGER NOT NULL,
	UNIQUE(root_id, rel_path)
);

CREATE INDEX IF NOT EXISTS idx_entries_root_parent ON entries(root_id, parent_rel_path);
CREATE INDEX IF NOT EXISTS idx_entries_kind ON entries(kind);
CREATE INDEX IF NOT EXISTS idx_entries_missing ON entries(missing);
CREATE INDEX IF NOT EXISTS idx_entries_updated ON entries(updated_at);

CREATE TABLE IF NOT EXISTS libraries (
	id         TEXT PRIMARY KEY,
	name       TEXT NOT NULL,
	slug       TEXT UNIQUE NOT NULL,
	icon       TEXT NOT NULL DEFAULT '',
	position   INTEGER NOT NULL DEFAULT 0,
	created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
	id         TEXT PRIMARY KEY,
	library_id TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
	parent_id  TEXT REFERENCES categories(id) ON DELETE CASCADE,
	name       TEXT NOT NULL,
	slug       TEXT NOT NULL,
	position   INTEGER NOT NULL DEFAULT 0,
	created_at INTEGER NOT NULL,
	UNIQUE(library_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_categories_library ON categories(library_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent  ON categories(parent_id);

CREATE TABLE IF NOT EXISTS entry_categories (
	entry_id    TEXT NOT NULL REFERENCES entries(id)    ON DELETE CASCADE,
	category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
	PRIMARY KEY (entry_id, category_id)
);

CREATE TABLE IF NOT EXISTS tags (
	id    TEXT PRIMARY KEY,
	name  TEXT UNIQUE NOT NULL,
	color TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS entry_tags (
	entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
	tag_id   TEXT NOT NULL REFERENCES tags(id)    ON DELETE CASCADE,
	PRIMARY KEY (entry_id, tag_id)
);

CREATE TABLE IF NOT EXISTS collections (
	id          TEXT PRIMARY KEY,
	name        TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS collection_entries (
	collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
	entry_id      TEXT NOT NULL REFERENCES entries(id)     ON DELETE CASCADE,
	position      INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (collection_id, entry_id)
);

CREATE TABLE IF NOT EXISTS favorites (
	entry_id   TEXT PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE,
	created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_views (
	id         TEXT PRIMARY KEY,
	name       TEXT NOT NULL,
	filters    TEXT NOT NULL DEFAULT '{}',
	created_at INTEGER NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
	name,
	rel_path,
	ext,
	all_tags,
	all_categories,
	content=''
);
`

func migrate(db *sql.DB) error {
	_, err := db.Exec(ddl)
	return err
}

// ResetDB deletes all data from every table but leaves the schema intact.
func ResetDB(db *sql.DB) error {
	tables := []string{
		"collection_entries", "entry_categories", "entry_tags",
		"favorites", "entries_fts", "entries", "categories",
		"libraries", "collections", "saved_views", "tags",
	}
	for _, t := range tables {
		if _, err := db.Exec("DELETE FROM " + t); err != nil {
			return err
		}
	}
	return nil
}
