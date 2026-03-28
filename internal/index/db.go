// internal/index/db.go
package index

import (
	"database/sql"

	_ "modernc.org/sqlite"
)

func Open(dsn string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}

	// SQLite only supports one writer at a time. A single connection avoids
	// SQLITE_BUSY errors on concurrent uploads and ensures pragmas apply to
	// the only connection in use.
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	pragmas := []string{
		"PRAGMA journal_mode=WAL",
		"PRAGMA foreign_keys=ON",
		"PRAGMA synchronous=NORMAL",
		"PRAGMA busy_timeout=5000",
	}
	for _, p := range pragmas {
		if _, err := db.Exec(p); err != nil {
			db.Close()
			return nil, err
		}
	}

	if err := migrate(db); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}
