// internal/index/scanner.go
package index

import (
	"database/sql"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	"github.com/rozeraf/files-dashboard/internal/fsops"
)

type ScanStats struct {
	Scanned int
	Added   int
	Updated int
	Missing int
}

type Scanner struct {
	db *sql.DB
}

func NewScanner(db *sql.DB) *Scanner {
	return &Scanner{db: db}
}

func (s *Scanner) ScanRoot(rootID, rootPath string) (ScanStats, error) {
	entries, err := fsops.WalkRoot(rootPath)
	if err != nil {
		return ScanStats{}, err
	}

	stats := ScanStats{Scanned: len(entries)}

	// mark all existing entries as potentially missing
	if _, err := s.db.Exec(`UPDATE entries SET missing=1 WHERE root_id=?`, rootID); err != nil {
		return stats, err
	}

	for _, e := range entries {
		ext := e.Ext
		mime := e.Mime
		var size *int64
		if e.Kind == "file" {
			size = e.Size
		}

		var existingID string
		err := s.db.QueryRow(
			`SELECT id FROM entries WHERE root_id=? AND rel_path=?`,
			rootID, e.RelPath,
		).Scan(&existingID)

		if err == sql.ErrNoRows {
			// insert new
			id := uuid.New().String()
			_, err = s.db.Exec(`
				INSERT INTO entries(id,root_id,rel_path,parent_rel_path,name,kind,size,mtime,ext,mime,missing,updated_at)
				VALUES(?,?,?,?,?,?,?,?,?,?,0,?)`,
				id, rootID, e.RelPath, e.ParentRelPath, e.Name, e.Kind, size, e.Mtime, ext, mime, time.Now().Unix(),
			)
			if err != nil {
				continue
			}
			stats.Added++
			s.ftsInsert(id, e.Name, e.RelPath, ext, "", "")
		} else if err == nil {
			_, err = s.db.Exec(`
				UPDATE entries SET missing=0, mtime=?, size=?, updated_at=? WHERE id=?`,
				e.Mtime, size, time.Now().Unix(), existingID,
			)
			if err == nil {
				stats.Updated++
			}
		}
	}

	// count truly missing
	row := s.db.QueryRow(`SELECT COUNT(*) FROM entries WHERE root_id=? AND missing=1`, rootID)
	row.Scan(&stats.Missing)

	return stats, nil
}

func (s *Scanner) ftsInsert(id, name, relPath, ext, allTags, allCats string) {
	s.db.Exec(`INSERT INTO entries_fts(rowid, name, rel_path, ext, all_tags, all_categories)
		SELECT rowid, ?, ?, ?, ?, ? FROM entries WHERE id=?`,
		name, relPath, ext, allTags, allCats, id)
}

// RootPath returns the filesystem path for a root ID.
func RootPath(db *sql.DB, rootID string) (string, error) {
	var path string
	err := db.QueryRow(`SELECT path FROM roots WHERE id=?`, rootID).Scan(&path)
	return path, err
}

// EntryAbsPath computes the absolute path for an entry.
func EntryAbsPath(db *sql.DB, entryID string) (string, error) {
	var rootPath, relPath string
	err := db.QueryRow(`
		SELECT r.path, e.rel_path FROM entries e
		JOIN roots r ON r.id = e.root_id
		WHERE e.id=?`, entryID,
	).Scan(&rootPath, &relPath)
	if err != nil {
		return "", err
	}
	return filepath.Join(rootPath, relPath), nil
}
