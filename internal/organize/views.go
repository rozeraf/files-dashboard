// internal/organize/views.go
package organize

import (
	"time"

	"github.com/google/uuid"
	"github.com/rozeraf/files-dashboard/internal/model"
)

func (s *Store) ListSavedViews() ([]model.SavedView, error) {
	rows, err := s.db.Query(`SELECT id,name,filters,created_at FROM saved_views ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var views []model.SavedView
	for rows.Next() {
		var v model.SavedView
		rows.Scan(&v.ID, &v.Name, &v.Filters, &v.CreatedAt)
		views = append(views, v)
	}
	return views, rows.Err()
}

func (s *Store) GetSavedView(id string) (model.SavedView, error) {
	var v model.SavedView
	err := s.db.QueryRow(`SELECT id,name,filters,created_at FROM saved_views WHERE id=?`, id).
		Scan(&v.ID, &v.Name, &v.Filters, &v.CreatedAt)
	return v, err
}

func (s *Store) CreateSavedView(name, filtersJSON string) (model.SavedView, error) {
	v := model.SavedView{ID: uuid.New().String(), Name: name, Filters: filtersJSON, CreatedAt: time.Now().Unix()}
	_, err := s.db.Exec(`INSERT INTO saved_views(id,name,filters,created_at) VALUES(?,?,?,?)`,
		v.ID, v.Name, v.Filters, v.CreatedAt)
	return v, err
}

func (s *Store) UpdateSavedView(id string, name *string, filtersJSON *string) error {
	if name != nil {
		if _, err := s.db.Exec(`UPDATE saved_views SET name=? WHERE id=?`, *name, id); err != nil {
			return err
		}
	}
	if filtersJSON != nil {
		if _, err := s.db.Exec(`UPDATE saved_views SET filters=? WHERE id=?`, *filtersJSON, id); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) DeleteSavedView(id string) error {
	_, err := s.db.Exec(`DELETE FROM saved_views WHERE id=?`, id)
	return err
}
