// internal/organize/tag.go
package organize

import (
	"time"

	"github.com/google/uuid"
	"github.com/rozeraf/files-dashboard/internal/model"
)

func (s *Store) ListTags() ([]model.Tag, error) {
	rows, err := s.db.Query(`SELECT id,name,color FROM tags ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var tags []model.Tag
	for rows.Next() {
		var t model.Tag
		rows.Scan(&t.ID, &t.Name, &t.Color)
		tags = append(tags, t)
	}
	return tags, rows.Err()
}

func (s *Store) GetTag(id string) (model.Tag, error) {
	var t model.Tag
	err := s.db.QueryRow(`SELECT id,name,color FROM tags WHERE id=?`, id).Scan(&t.ID, &t.Name, &t.Color)
	return t, err
}

func (s *Store) CreateTag(name, color string) (model.Tag, error) {
	tag := model.Tag{ID: uuid.New().String(), Name: name, Color: color}
	_, err := s.db.Exec(`INSERT INTO tags(id,name,color) VALUES(?,?,?)`, tag.ID, tag.Name, tag.Color)
	return tag, err
}

func (s *Store) UpdateTag(id string, name *string, color string) error {
	if name != nil {
		if _, err := s.db.Exec(`UPDATE tags SET name=? WHERE id=?`, *name, id); err != nil {
			return err
		}
	}
	if color != "" {
		if _, err := s.db.Exec(`UPDATE tags SET color=? WHERE id=?`, color, id); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) DeleteTag(id string) error {
	_, err := s.db.Exec(`DELETE FROM tags WHERE id=?`, id)
	return err
}

func (s *Store) AssignEntryTags(entryID string, add, remove []string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, tid := range remove {
		if _, err := tx.Exec(`DELETE FROM entry_tags WHERE entry_id=? AND tag_id=?`, entryID, tid); err != nil {
			return err
		}
	}
	for _, tid := range add {
		if _, err := tx.Exec(`INSERT OR IGNORE INTO entry_tags(entry_id,tag_id) VALUES(?,?)`, entryID, tid); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Store) EntryTags(entryID string) ([]model.Tag, error) {
	rows, err := s.db.Query(`SELECT t.id,t.name,t.color FROM tags t JOIN entry_tags et ON et.tag_id=t.id WHERE et.entry_id=?`, entryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var tags []model.Tag
	for rows.Next() {
		var t model.Tag
		rows.Scan(&t.ID, &t.Name, &t.Color)
		tags = append(tags, t)
	}
	return tags, rows.Err()
}

// ListFavorites returns favorites ordered by created_at DESC.
func (s *Store) ListFavorites(limit int) ([]model.Entry, error) {
	if limit == 0 {
		limit = 50
	}
	rows, err := s.db.Query(`
		SELECT e.id,e.root_id,e.rel_path,e.parent_rel_path,e.name,e.kind,e.size,e.mtime,e.ext,e.mime,e.missing,e.updated_at
		FROM entries e JOIN favorites f ON f.entry_id=e.id
		ORDER BY f.created_at DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanEntries(rows)
}

func (s *Store) AddFavorite(entryID string) error {
	_, err := s.db.Exec(`INSERT OR IGNORE INTO favorites(entry_id,created_at) VALUES(?,?)`,
		entryID, time.Now().Unix())
	return err
}

func (s *Store) RemoveFavorite(entryID string) error {
	_, err := s.db.Exec(`DELETE FROM favorites WHERE entry_id=?`, entryID)
	return err
}

func (s *Store) IsFavorited(entryID string) bool {
	var c int
	s.db.QueryRow(`SELECT COUNT(*) FROM favorites WHERE entry_id=?`, entryID).Scan(&c)
	return c > 0
}
