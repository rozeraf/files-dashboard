// internal/index/search.go
package index

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/rozeraf/files-dashboard/internal/model"
)

type SearchParams struct {
	LibraryID  string
	CategoryID string
	Tags       []string
	Ext        string
	Kind       string
	Since      int64
	SizeMin    int64
	SizeMax    int64
	Status     string // "favorite" | "uncategorized" | "missing"
	Page       int
	Limit      int
}

type SearchResult struct {
	model.Entry
	TotalCount int `json:"-"`
}

func (s *Syncer) Search(q string, p SearchParams) ([]model.Entry, error) {
	if p.Page < 1 {
		p.Page = 1
	}

	var joins []string
	var wheres []string
	var args []any

	baseSelect := `SELECT e.id, e.root_id, e.rel_path, e.parent_rel_path, e.name,
		e.kind, e.size, e.mtime, e.ext, e.mime, e.missing, e.updated_at
		FROM entries e`

	if q != "" {
		joins = append(joins, `JOIN entries_fts ON entries_fts.rowid = e.rowid`)
		wheres = append(wheres, `entries_fts MATCH ?`)
		// Escape FTS5 special characters by wrapping in double quotes (phrase query).
		escaped := strings.ReplaceAll(q, `"`, `""`)
		args = append(args, `"`+escaped+`"*`)
	}

	if p.LibraryID != "" {
		joins = append(joins, `JOIN entry_categories ec_lib ON ec_lib.entry_id = e.id`)
		joins = append(joins, `JOIN categories cat_lib ON cat_lib.id = ec_lib.category_id AND cat_lib.library_id = ?`)
		args = append(args, p.LibraryID)
	}

	if p.CategoryID != "" {
		joins = append(joins, `JOIN entry_categories ec_cat ON ec_cat.entry_id = e.id AND ec_cat.category_id = ?`)
		args = append(args, p.CategoryID)
	}

	if len(p.Tags) > 0 {
		joins = append(joins, `JOIN entry_tags et_filter ON et_filter.entry_id = e.id`)
		ph := make([]string, len(p.Tags))
		for i := range ph {
			ph[i] = "?"
		}
		wheres = append(wheres, `et_filter.tag_id IN (`+strings.Join(ph, ",")+`)`)
		for _, tid := range p.Tags {
			args = append(args, tid)
		}
	}

	if p.Ext != "" {
		wheres = append(wheres, `e.ext = ?`)
		args = append(args, p.Ext)
	}
	if p.Kind != "" {
		wheres = append(wheres, `e.kind = ?`)
		args = append(args, p.Kind)
	}
	if p.Since > 0 {
		wheres = append(wheres, `e.updated_at >= ?`)
		args = append(args, p.Since)
	}
	if p.SizeMin > 0 {
		wheres = append(wheres, `e.size >= ?`)
		args = append(args, p.SizeMin)
	}
	if p.SizeMax > 0 {
		wheres = append(wheres, `e.size <= ?`)
		args = append(args, p.SizeMax)
	}

	switch p.Status {
	case "favorite":
		joins = append(joins, `JOIN favorites f ON f.entry_id = e.id`)
	case "uncategorized":
		wheres = append(wheres, `NOT EXISTS (SELECT 1 FROM entry_categories ec WHERE ec.entry_id = e.id)`)
	case "missing":
		wheres = append(wheres, `e.missing = 1`)
	}

	query := baseSelect
	if len(joins) > 0 {
		query += " " + strings.Join(joins, " ")
	}
	if len(wheres) > 0 {
		query += " WHERE " + strings.Join(wheres, " AND ")
	}
	query += " ORDER BY e.name ASC"
	if p.Limit > 0 {
		offset := (p.Page - 1) * p.Limit
		query += fmt.Sprintf(" LIMIT %d OFFSET %d", p.Limit, offset)
	}

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []model.Entry
	for rows.Next() {
		var e model.Entry
		rows.Scan(&e.ID, &e.RootID, &e.RelPath, &e.ParentRelPath, &e.Name,
			&e.Kind, &e.Size, &e.Mtime, &e.Ext, &e.Mime, &e.Missing, &e.UpdatedAt)
		results = append(results, e)
	}
	return results, rows.Err()
}

// GetEntry fetches a single entry by ID.
func GetEntry(db *sql.DB, id string) (model.Entry, error) {
	var e model.Entry
	err := db.QueryRow(`
		SELECT id,root_id,rel_path,parent_rel_path,name,kind,size,mtime,ext,mime,missing,updated_at
		FROM entries WHERE id=?`, id,
	).Scan(&e.ID, &e.RootID, &e.RelPath, &e.ParentRelPath, &e.Name,
		&e.Kind, &e.Size, &e.Mtime, &e.Ext, &e.Mime, &e.Missing, &e.UpdatedAt)
	return e, err
}
