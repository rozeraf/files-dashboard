// internal/organize/library.go
package organize

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
	"github.com/rozeraf/files-dashboard/internal/model"
)

// Store is the organize layer — all logical organization operations.
type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

// --- Libraries ---

func (s *Store) ListLibraries() ([]model.Library, error) {
	rows, err := s.db.Query(`SELECT id,name,slug,icon,position,created_at FROM libraries ORDER BY position`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var libs []model.Library
	for rows.Next() {
		var l model.Library
		rows.Scan(&l.ID, &l.Name, &l.Slug, &l.Icon, &l.Position, &l.CreatedAt)
		libs = append(libs, l)
	}
	return libs, rows.Err()
}

func (s *Store) GetLibrary(id string) (model.Library, error) {
	var l model.Library
	err := s.db.QueryRow(`SELECT id,name,slug,icon,position,created_at FROM libraries WHERE id=?`, id).
		Scan(&l.ID, &l.Name, &l.Slug, &l.Icon, &l.Position, &l.CreatedAt)
	return l, err
}

func (s *Store) CreateLibrary(name, icon string) (model.Library, error) {
	l := model.Library{
		ID:        uuid.New().String(),
		Name:      name,
		Slug:      model.Slugify(name),
		Icon:      icon,
		CreatedAt: time.Now().Unix(),
	}
	_, err := s.db.Exec(`INSERT INTO libraries(id,name,slug,icon,position,created_at) VALUES(?,?,?,?,0,?)`,
		l.ID, l.Name, l.Slug, l.Icon, l.CreatedAt)
	return l, err
}

type LibraryUpdate struct {
	Name     *string
	Icon     *string
	Position *int
}

func (s *Store) UpdateLibrary(id string, fn func(*LibraryUpdate)) error {
	u := &LibraryUpdate{}
	fn(u)
	if u.Name != nil {
		if _, err := s.db.Exec(`UPDATE libraries SET name=? WHERE id=?`, *u.Name, id); err != nil {
			return err
		}
	}
	if u.Icon != nil {
		if _, err := s.db.Exec(`UPDATE libraries SET icon=? WHERE id=?`, *u.Icon, id); err != nil {
			return err
		}
	}
	if u.Position != nil {
		if _, err := s.db.Exec(`UPDATE libraries SET position=? WHERE id=?`, *u.Position, id); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) DeleteLibrary(id string) error {
	_, err := s.db.Exec(`DELETE FROM libraries WHERE id=?`, id)
	return err
}

// SeedDefaultLibraries creates the default set if no libraries exist.
func (s *Store) SeedDefaultLibraries() error {
	var count int
	s.db.QueryRow(`SELECT COUNT(*) FROM libraries`).Scan(&count)
	if count > 0 {
		return nil
	}
	defaults := []struct{ name, icon string }{
		{"Videos", "🎬"},
		{"Images", "🖼"},
		{"Documents", "📄"},
		{"Archives", "📦"},
		{"Mixed", "📁"},
	}
	for i, d := range defaults {
		lib, err := s.CreateLibrary(d.name, d.icon)
		if err != nil {
			return err
		}
		s.db.Exec(`UPDATE libraries SET position=? WHERE id=?`, i, lib.ID)
	}
	return nil
}

// --- Categories ---

func (s *Store) CategoryTree(libraryID string) ([]*model.Category, error) {
	rows, err := s.db.Query(`SELECT id,library_id,parent_id,name,slug,position,created_at FROM categories WHERE library_id=? ORDER BY position`, libraryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	all := map[string]*model.Category{}
	var order []string
	for rows.Next() {
		var c model.Category
		var pid sql.NullString
		rows.Scan(&c.ID, &c.LibraryID, &pid, &c.Name, &c.Slug, &c.Position, &c.CreatedAt)
		if pid.Valid {
			c.ParentID = &pid.String
		}
		all[c.ID] = &c
		order = append(order, c.ID)
	}
	var roots []*model.Category
	for _, id := range order {
		c := all[id]
		if c.ParentID == nil {
			roots = append(roots, c)
		} else {
			parent := all[*c.ParentID]
			if parent != nil {
				parent.Children = append(parent.Children, c)
			}
		}
	}
	return roots, nil
}

func (s *Store) CreateCategory(libraryID string, parentID *string, name string) (model.Category, error) {
	c := model.Category{
		ID:        uuid.New().String(),
		LibraryID: libraryID,
		ParentID:  parentID,
		Name:      name,
		Slug:      model.Slugify(name),
		CreatedAt: time.Now().Unix(),
	}
	_, err := s.db.Exec(`
		INSERT INTO categories(id,library_id,parent_id,name,slug,position,created_at)
		VALUES(?,?,?,?,?,0,?)`,
		c.ID, c.LibraryID, c.ParentID, c.Name, c.Slug, c.CreatedAt)
	return c, err
}

func (s *Store) UpdateCategory(id string, name *string, parentID *string, position *int) error {
	if name != nil {
		if _, err := s.db.Exec(`UPDATE categories SET name=? WHERE id=?`, *name, id); err != nil {
			return err
		}
	}
	if parentID != nil {
		if _, err := s.db.Exec(`UPDATE categories SET parent_id=? WHERE id=?`, *parentID, id); err != nil {
			return err
		}
	}
	if position != nil {
		if _, err := s.db.Exec(`UPDATE categories SET position=? WHERE id=?`, *position, id); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) DeleteCategory(id string) error {
	_, err := s.db.Exec(`DELETE FROM categories WHERE id=?`, id)
	return err
}

func (s *Store) GetCategory(id string) (model.Category, error) {
	var c model.Category
	var pid sql.NullString
	err := s.db.QueryRow(`SELECT id,library_id,parent_id,name,slug,position,created_at FROM categories WHERE id=?`, id).
		Scan(&c.ID, &c.LibraryID, &pid, &c.Name, &c.Slug, &c.Position, &c.CreatedAt)
	if pid.Valid {
		c.ParentID = &pid.String
	}
	return c, err
}

func (s *Store) ListSubcategories(parentID string) ([]model.Category, error) {
	rows, err := s.db.Query(`SELECT id,library_id,parent_id,name,slug,position,created_at FROM categories WHERE parent_id=? ORDER BY position`, parentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var cats []model.Category
	for rows.Next() {
		var c model.Category
		var pid sql.NullString
		rows.Scan(&c.ID, &c.LibraryID, &pid, &c.Name, &c.Slug, &c.Position, &c.CreatedAt)
		if pid.Valid {
			c.ParentID = &pid.String
		}
		cats = append(cats, c)
	}
	return cats, rows.Err()
}

// AssignEntryCategories performs a delta assignment (add + remove).
func (s *Store) AssignEntryCategories(entryID string, add, remove []string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, cid := range remove {
		if _, err := tx.Exec(`DELETE FROM entry_categories WHERE entry_id=? AND category_id=?`, entryID, cid); err != nil {
			return err
		}
	}
	for _, cid := range add {
		if _, err := tx.Exec(`INSERT OR IGNORE INTO entry_categories(entry_id,category_id) VALUES(?,?)`, entryID, cid); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// CategoryEntries returns paginated entries assigned to a category.
func (s *Store) CategoryEntries(categoryID string, page, limit int) ([]model.Entry, int, error) {
	if limit == 0 {
		limit = 50
	}
	if page < 1 {
		page = 1
	}
	offset := (page - 1) * limit

	var total int
	s.db.QueryRow(`SELECT COUNT(*) FROM entry_categories WHERE category_id=?`, categoryID).Scan(&total)

	rows, err := s.db.Query(`
		SELECT e.id,e.root_id,e.rel_path,e.parent_rel_path,e.name,e.kind,e.size,e.mtime,e.ext,e.mime,e.missing,e.updated_at
		FROM entries e JOIN entry_categories ec ON ec.entry_id=e.id
		WHERE ec.category_id=? ORDER BY e.name LIMIT ? OFFSET ?`,
		categoryID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var entries []model.Entry
	for rows.Next() {
		var e model.Entry
		rows.Scan(&e.ID, &e.RootID, &e.RelPath, &e.ParentRelPath, &e.Name, &e.Kind, &e.Size, &e.Mtime, &e.Ext, &e.Mime, &e.Missing, &e.UpdatedAt)
		entries = append(entries, e)
	}
	return entries, total, rows.Err()
}
