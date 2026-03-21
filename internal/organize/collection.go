// internal/organize/collection.go
package organize

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
	"github.com/rozeraf/files-dashboard/internal/model"
)

func (s *Store) DB() *sql.DB { return s.db }

func (s *Store) ListCollections() ([]model.Collection, error) {
	rows, err := s.db.Query(`SELECT id,name,description,created_at FROM collections ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var cols []model.Collection
	for rows.Next() {
		var c model.Collection
		rows.Scan(&c.ID, &c.Name, &c.Description, &c.CreatedAt)
		cols = append(cols, c)
	}
	return cols, rows.Err()
}

func (s *Store) GetCollection(id string) (model.Collection, error) {
	var c model.Collection
	err := s.db.QueryRow(`SELECT id,name,description,created_at FROM collections WHERE id=?`, id).
		Scan(&c.ID, &c.Name, &c.Description, &c.CreatedAt)
	return c, err
}

func (s *Store) CreateCollection(name, description string) (model.Collection, error) {
	c := model.Collection{ID: uuid.New().String(), Name: name, Description: description, CreatedAt: time.Now().Unix()}
	_, err := s.db.Exec(`INSERT INTO collections(id,name,description,created_at) VALUES(?,?,?,?)`,
		c.ID, c.Name, c.Description, c.CreatedAt)
	return c, err
}

func (s *Store) UpdateCollection(id string, name, description *string) error {
	if name != nil {
		if _, err := s.db.Exec(`UPDATE collections SET name=? WHERE id=?`, *name, id); err != nil {
			return err
		}
	}
	if description != nil {
		if _, err := s.db.Exec(`UPDATE collections SET description=? WHERE id=?`, *description, id); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) DeleteCollection(id string) error {
	_, err := s.db.Exec(`DELETE FROM collections WHERE id=?`, id)
	return err
}

func (s *Store) CollectionEntries(collectionID string, page, limit int) ([]model.Entry, int, error) {
	if limit == 0 {
		limit = 50
	}
	if page < 1 {
		page = 1
	}
	offset := (page - 1) * limit

	var total int
	s.db.QueryRow(`SELECT COUNT(*) FROM collection_entries WHERE collection_id=?`, collectionID).Scan(&total)

	rows, err := s.db.Query(`
		SELECT e.id,e.root_id,e.rel_path,e.parent_rel_path,e.name,e.kind,e.size,e.mtime,e.ext,e.mime,e.missing,e.updated_at
		FROM entries e JOIN collection_entries ce ON ce.entry_id=e.id
		WHERE ce.collection_id=? ORDER BY ce.position LIMIT ? OFFSET ?`,
		collectionID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	entries, err := scanEntries(rows)
	return entries, total, err
}

func (s *Store) AddToCollection(collectionID, entryID string) error {
	var maxPos int
	s.db.QueryRow(`SELECT COALESCE(MAX(position),0) FROM collection_entries WHERE collection_id=?`, collectionID).Scan(&maxPos)
	_, err := s.db.Exec(`INSERT OR IGNORE INTO collection_entries(collection_id,entry_id,position) VALUES(?,?,?)`,
		collectionID, entryID, maxPos+1)
	return err
}

func (s *Store) RemoveFromCollection(collectionID, entryID string) error {
	_, err := s.db.Exec(`DELETE FROM collection_entries WHERE collection_id=? AND entry_id=?`, collectionID, entryID)
	return err
}

func (s *Store) ReorderCollection(collectionID string, order []string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for i, entryID := range order {
		if _, err := tx.Exec(`UPDATE collection_entries SET position=? WHERE collection_id=? AND entry_id=?`,
			i, collectionID, entryID); err != nil {
			return err
		}
	}
	return tx.Commit()
}
