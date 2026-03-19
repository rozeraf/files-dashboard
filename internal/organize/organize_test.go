// internal/organize/organize_test.go
package organize_test

import (
	"database/sql"
	"testing"

	"github.com/google/uuid"
	"github.com/rozeraf/files-dashboard/internal/index"
	"github.com/rozeraf/files-dashboard/internal/organize"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func openTestDB(t *testing.T) *organize.Store {
	t.Helper()
	db, err := index.Open(":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { db.Close() })
	return organize.NewStore(db)
}

func TestLibraryCRUD(t *testing.T) {
	s := openTestDB(t)

	lib, err := s.CreateLibrary("Videos", "🎬")
	require.NoError(t, err)
	assert.Equal(t, "Videos", lib.Name)
	assert.Equal(t, "videos", lib.Slug)

	libs, err := s.ListLibraries()
	require.NoError(t, err)
	assert.Len(t, libs, 1)

	err = s.UpdateLibrary(lib.ID, func(l *organize.LibraryUpdate) {
		n := "My Videos"
		l.Name = &n
	})
	require.NoError(t, err)

	updated, _ := s.GetLibrary(lib.ID)
	assert.Equal(t, "My Videos", updated.Name)
	assert.Equal(t, "videos", updated.Slug) // slug unchanged

	err = s.DeleteLibrary(lib.ID)
	require.NoError(t, err)
	libs, _ = s.ListLibraries()
	assert.Empty(t, libs)
}

func TestCategoryTree(t *testing.T) {
	s := openTestDB(t)

	lib, _ := s.CreateLibrary("Videos", "🎬")
	parent, err := s.CreateCategory(lib.ID, nil, "Animals")
	require.NoError(t, err)
	assert.Equal(t, "animals", parent.Slug)

	child, err := s.CreateCategory(lib.ID, &parent.ID, "Cats")
	require.NoError(t, err)

	tree, err := s.CategoryTree(lib.ID)
	require.NoError(t, err)
	require.Len(t, tree, 1)
	assert.Equal(t, parent.ID, tree[0].ID)
	require.Len(t, tree[0].Children, 1)
	assert.Equal(t, child.ID, tree[0].Children[0].ID)
}

func TestTagsCRUD(t *testing.T) {
	s := openTestDB(t)
	tag, err := s.CreateTag("nature", "#00ff00")
	require.NoError(t, err)
	assert.Equal(t, "nature", tag.Name)

	err = s.UpdateTag(tag.ID, nil, func() string { return "#ff0000" }())
	require.NoError(t, err)
	tags, _ := s.ListTags()
	assert.Len(t, tags, 1)

	err = s.DeleteTag(tag.ID)
	require.NoError(t, err)
	tags, _ = s.ListTags()
	assert.Empty(t, tags)
}

func TestCollectionReorder(t *testing.T) {
	s := openTestDB(t)

	// seed entries
	db := s.DB()
	rootID := "root-1"
	db.Exec(`INSERT INTO roots(id,path,label,created_at) VALUES(?,?,?,?)`, rootID, "/tmp", "r", 1)
	e1 := seedEntry(t, db, rootID, "a.txt")
	e2 := seedEntry(t, db, rootID, "b.txt")
	e3 := seedEntry(t, db, rootID, "c.txt")

	col, _ := s.CreateCollection("My Col", "")
	s.AddToCollection(col.ID, e1)
	s.AddToCollection(col.ID, e2)
	s.AddToCollection(col.ID, e3)

	err := s.ReorderCollection(col.ID, []string{e3, e1, e2})
	require.NoError(t, err)

	entries, _, _ := s.CollectionEntries(col.ID, 1, 50)
	require.Len(t, entries, 3)
	assert.Equal(t, e3, entries[0].ID)
	assert.Equal(t, e1, entries[1].ID)
	assert.Equal(t, e2, entries[2].ID)
}

func seedEntry(t *testing.T, db interface {
	Exec(string, ...any) (sql.Result, error)
}, rootID, name string) string {
	id := uuid.New().String()
	db.Exec(`INSERT INTO entries(id,root_id,rel_path,parent_rel_path,name,kind,mtime,ext,mime,missing,updated_at)
		VALUES(?,?,?,?,?,?,?,?,?,0,?)`, id, rootID, name, "", name, "file", 1, "txt", "text/plain", 1)
	return id
}
