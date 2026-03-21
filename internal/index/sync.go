// internal/index/sync.go
package index

import (
	"database/sql"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rozeraf/files-dashboard/internal/model"
)

type Syncer struct {
	db *sql.DB
}

func NewSyncer(db *sql.DB) *Syncer {
	return &Syncer{db: db}
}

// AfterRename updates rel_path and parent_rel_path for an entry and all subtree descendants.
func (s *Syncer) AfterRename(rootID, oldRelPath, newRelPath string) error {
	// Collect renamed entry's ID before the update for FTS sync
	var renamedEntryID string
	s.db.QueryRow(`SELECT id FROM entries WHERE root_id=? AND rel_path=?`, rootID, oldRelPath).Scan(&renamedEntryID)

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	now := time.Now().Unix()
	// update the entry itself
	_, err = tx.Exec(`
		UPDATE entries SET rel_path=?, parent_rel_path=?, name=?, updated_at=?
		WHERE root_id=? AND rel_path=?`,
		newRelPath, parentOf(newRelPath), baseName(newRelPath), now,
		rootID, oldRelPath,
	)
	if err != nil {
		return err
	}
	// update descendants (entries whose rel_path starts with oldRelPath/)
	prefix := oldRelPath + "/"
	rows, err := tx.Query(`SELECT id, rel_path FROM entries WHERE root_id=? AND rel_path LIKE ?`,
		rootID, prefix+"%")
	if err != nil {
		return err
	}
	type patch struct{ id, newRel string }
	var patches []patch
	for rows.Next() {
		var id, rel string
		rows.Scan(&id, &rel)
		newRel := newRelPath + "/" + strings.TrimPrefix(rel, prefix)
		patches = append(patches, patch{id, newRel})
	}
	rows.Close()
	for _, p := range patches {
		tx.Exec(`UPDATE entries SET rel_path=?, parent_rel_path=?, updated_at=? WHERE id=?`,
			p.newRel, parentOf(p.newRel), now, p.id)
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	// Sync FTS for the renamed entry and all descendants (re-reads fresh name/rel_path from entries)
	if renamedEntryID != "" {
		s.ftsUpdate(renamedEntryID, "", "")
	}
	for _, p := range patches {
		s.ftsUpdate(p.id, "", "")
	}
	return nil
}

// AfterDelete removes index entries and their FTS rows.
func (s *Syncer) AfterDelete(ids []string) error {
	for _, id := range ids {
		var rowid int64
		if err := s.db.QueryRow(`SELECT rowid FROM entries WHERE id=?`, id).Scan(&rowid); err != nil {
			continue // entry already gone
		}
		s.db.Exec(`DELETE FROM entries_fts WHERE rowid=?`, rowid)
		if _, err := s.db.Exec(`DELETE FROM entries WHERE id=?`, id); err != nil {
			return err
		}
	}
	return nil
}

// UpdateFTSTags refreshes the all_tags FTS column for an entry.
func (s *Syncer) UpdateFTSTags(entryID string) error {
	rows, err := s.db.Query(`SELECT t.name FROM tags t JOIN entry_tags et ON et.tag_id=t.id WHERE et.entry_id=?`, entryID)
	if err != nil {
		return err
	}
	defer rows.Close()
	var names []string
	for rows.Next() {
		var n string
		rows.Scan(&n)
		names = append(names, n)
	}
	allTags := strings.Join(names, " ")
	return s.ftsUpdate(entryID, "all_tags", allTags)
}

// UpdateFTSCategories refreshes the all_categories FTS column for an entry.
func (s *Syncer) UpdateFTSCategories(entryID string) error {
	rows, err := s.db.Query(`SELECT c.name FROM categories c JOIN entry_categories ec ON ec.category_id=c.id WHERE ec.entry_id=?`, entryID)
	if err != nil {
		return err
	}
	defer rows.Close()
	var names []string
	for rows.Next() {
		var n string
		rows.Scan(&n)
		names = append(names, n)
	}
	allCats := strings.Join(names, " ")
	return s.ftsUpdate(entryID, "all_categories", allCats)
}

// RebuildFTS deletes all FTS content and re-inserts from entries + joined tags/categories.
func (s *Syncer) RebuildFTS() error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`DELETE FROM entries_fts`); err != nil {
		return err
	}
	rows, err := tx.Query(`SELECT id, rowid, name, rel_path, ext FROM entries WHERE missing=0`)
	if err != nil {
		return err
	}
	type row struct {
		id, name, relPath, ext string
		rowid                  int64
	}
	var entries []row
	for rows.Next() {
		var r row
		rows.Scan(&r.id, &r.rowid, &r.name, &r.relPath, &r.ext)
		entries = append(entries, r)
	}
	rows.Close()

	for _, e := range entries {
		allTags := s.aggregateTags(tx, e.id)
		allCats := s.aggregateCategories(tx, e.id)
		tx.Exec(`INSERT INTO entries_fts(rowid,name,rel_path,ext,all_tags,all_categories) VALUES(?,?,?,?,?,?)`,
			e.rowid, e.name, e.relPath, e.ext, allTags, allCats)
	}
	return tx.Commit()
}

func (s *Syncer) ftsUpdate(entryID, col, value string) error {
	var rowid int64
	if err := s.db.QueryRow(`SELECT rowid FROM entries WHERE id=?`, entryID).Scan(&rowid); err != nil {
		return err
	}
	// FTS5 contentless: delete + re-insert
	var name, relPath, ext, allTags, allCats string
	if err := s.db.QueryRow(`SELECT name, rel_path, ext FROM entries WHERE id=?`, entryID).Scan(&name, &relPath, &ext); err != nil {
		return err
	}
	// get current FTS values for other columns (may not exist yet, that's ok)
	s.db.QueryRow(`SELECT all_tags, all_categories FROM entries_fts WHERE rowid=?`, rowid).Scan(&allTags, &allCats)
	switch col {
	case "all_tags":
		allTags = value
	case "all_categories":
		allCats = value
	}
	if _, err := s.db.Exec(`DELETE FROM entries_fts WHERE rowid=?`, rowid); err != nil {
		return err
	}
	_, err := s.db.Exec(`INSERT INTO entries_fts(rowid,name,rel_path,ext,all_tags,all_categories) VALUES(?,?,?,?,?,?)`,
		rowid, name, relPath, ext, allTags, allCats)
	return err
}

func (s *Syncer) aggregateTags(tx *sql.Tx, entryID string) string {
	rows, err := tx.Query(`SELECT t.name FROM tags t JOIN entry_tags et ON et.tag_id=t.id WHERE et.entry_id=?`, entryID)
	if err != nil {
		return ""
	}
	defer rows.Close()
	var names []string
	for rows.Next() {
		var n string
		rows.Scan(&n)
		names = append(names, n)
	}
	return strings.Join(names, " ")
}

func (s *Syncer) aggregateCategories(tx *sql.Tx, entryID string) string {
	rows, err := tx.Query(`SELECT c.name FROM categories c JOIN entry_categories ec ON ec.category_id=c.id WHERE ec.entry_id=?`, entryID)
	if err != nil {
		return ""
	}
	defer rows.Close()
	var names []string
	for rows.Next() {
		var n string
		rows.Scan(&n)
		names = append(names, n)
	}
	return strings.Join(names, " ")
}

// AddEntry inserts a single new entry into the DB and FTS index.
func (s *Syncer) AddEntry(rootID string, e model.Entry) (string, error) {
	id := uuid.New().String()
	now := time.Now().Unix()
	_, err := s.db.Exec(`
		INSERT INTO entries(id,root_id,rel_path,parent_rel_path,name,kind,size,mtime,ext,mime,missing,updated_at)
		VALUES(?,?,?,?,?,?,?,?,?,?,0,?)`,
		id, rootID, e.RelPath, e.ParentRelPath, e.Name, e.Kind, e.Size, e.Mtime, e.Ext, e.Mime, now,
	)
	if err != nil {
		return "", err
	}
	s.db.Exec(`INSERT INTO entries_fts(rowid,name,rel_path,ext,all_tags,all_categories)
		SELECT rowid,?,?,?,'','' FROM entries WHERE id=?`,
		e.Name, e.RelPath, e.Ext, id)
	return id, nil
}

func parentOf(relPath string) string {
	d := relPath
	for i := len(d) - 1; i >= 0; i-- {
		if d[i] == '/' {
			return d[:i]
		}
	}
	return ""
}

func baseName(relPath string) string {
	for i := len(relPath) - 1; i >= 0; i-- {
		if relPath[i] == '/' {
			return relPath[i+1:]
		}
	}
	return relPath
}
