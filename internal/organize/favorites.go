// internal/organize/favorites.go
package organize

import (
	"database/sql"

	"github.com/rozeraf/files-dashboard/internal/model"
)

func (s *Store) RecentEntries(limit int) ([]model.Entry, error) {
	query := `
		SELECT id,root_id,rel_path,parent_rel_path,name,kind,size,mtime,ext,mime,missing,updated_at
		FROM entries WHERE missing=0 AND kind='file' ORDER BY mtime DESC`
	var (
		rows *sql.Rows
		err  error
	)
	if limit > 0 {
		rows, err = s.db.Query(query+` LIMIT ?`, limit)
	} else {
		rows, err = s.db.Query(query)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanEntries(rows)
}

func (s *Store) UncategorizedEntries(page, limit int) ([]model.Entry, int, error) {
	if page < 1 {
		page = 1
	}

	var total int
	s.db.QueryRow(`SELECT COUNT(*) FROM entries WHERE missing=0 AND NOT EXISTS (SELECT 1 FROM entry_categories ec WHERE ec.entry_id=entries.id)`).Scan(&total)

	query := `
		SELECT id,root_id,rel_path,parent_rel_path,name,kind,size,mtime,ext,mime,missing,updated_at
		FROM entries WHERE missing=0 AND NOT EXISTS (SELECT 1 FROM entry_categories ec WHERE ec.entry_id=entries.id)
		ORDER BY name ASC`
	args := []any{}
	if limit > 0 {
		offset := (page - 1) * limit
		query += ` LIMIT ? OFFSET ?`
		args = append(args, limit, offset)
	}
	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	entries, err := scanEntries(rows)
	return entries, total, err
}

func scanEntries(rows *sql.Rows) ([]model.Entry, error) {
	var entries []model.Entry
	for rows.Next() {
		var e model.Entry
		rows.Scan(&e.ID, &e.RootID, &e.RelPath, &e.ParentRelPath, &e.Name, &e.Kind, &e.Size, &e.Mtime, &e.Ext, &e.Mime, &e.Missing, &e.UpdatedAt)
		entries = append(entries, e)
	}
	return entries, rows.Err()
}
