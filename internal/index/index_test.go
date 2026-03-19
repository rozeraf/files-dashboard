// internal/index/index_test.go
package index_test

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/rozeraf/files-dashboard/internal/index"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOpenAndMigrate(t *testing.T) {
	db, err := index.Open(":memory:")
	require.NoError(t, err)
	defer db.Close()

	// tables should exist
	tables := []string{
		"roots", "entries", "libraries", "categories",
		"entry_categories", "tags", "entry_tags",
		"collections", "collection_entries", "favorites", "saved_views",
	}
	for _, table := range tables {
		var name string
		err := db.QueryRow(
			"SELECT name FROM sqlite_master WHERE type='table' AND name=?", table,
		).Scan(&name)
		assert.NoError(t, err, "table %s should exist", table)
	}

	// FTS5 virtual table
	var vtName string
	err = db.QueryRow(
		"SELECT name FROM sqlite_master WHERE type='table' AND name='entries_fts'",
	).Scan(&vtName)
	assert.NoError(t, err, "entries_fts FTS5 table should exist")
}

func TestScanRoot(t *testing.T) {
	// set up temp FS
	root := t.TempDir()
	os.WriteFile(filepath.Join(root, "a.txt"), []byte("hello"), 0644)
	subdir := filepath.Join(root, "sub")
	os.Mkdir(subdir, 0755)
	os.WriteFile(filepath.Join(subdir, "b.mp4"), []byte("video"), 0644)

	db, _ := index.Open(":memory:")
	defer db.Close()

	// insert a root
	rootID := "root-1"
	db.Exec(`INSERT INTO roots(id,path,label,created_at) VALUES(?,?,?,?)`,
		rootID, root, "Test Root", time.Now().Unix())

	s := index.NewScanner(db)
	stats, err := s.ScanRoot(rootID, root)
	require.NoError(t, err)
	assert.Equal(t, 3, stats.Scanned) // sub/, a.txt, sub/b.mp4
	assert.Equal(t, 3, stats.Added)

	// re-scan: no new entries
	stats2, err := s.ScanRoot(rootID, root)
	require.NoError(t, err)
	assert.Equal(t, 3, stats2.Scanned)
	assert.Equal(t, 0, stats2.Added)
}

func TestFTSSync(t *testing.T) {
	db, _ := index.Open(":memory:")
	defer db.Close()

	root := t.TempDir()
	rootID := "root-fts"
	db.Exec(`INSERT INTO roots(id,path,label,created_at) VALUES(?,?,?,?)`,
		rootID, root, "FTS Root", time.Now().Unix())

	os.WriteFile(filepath.Join(root, "cat_video.mp4"), []byte("v"), 0644)
	scanner := index.NewScanner(db)
	scanner.ScanRoot(rootID, root)

	// verify FTS finds the entry by name
	syncer := index.NewSyncer(db)
	results, err := syncer.Search("cat_video", index.SearchParams{})
	require.NoError(t, err)
	assert.Len(t, results, 1)
	assert.Equal(t, "cat_video.mp4", results[0].Name)
}
