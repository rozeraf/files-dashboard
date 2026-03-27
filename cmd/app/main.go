// cmd/app/main.go
package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/rozeraf/files-dashboard/internal/config"
	"github.com/rozeraf/files-dashboard/internal/httpapi"
	"github.com/rozeraf/files-dashboard/internal/index"
	"github.com/rozeraf/files-dashboard/internal/organize"
)

func main() {
	dataDir := envOr("DATA_DIR", "data")
	configPath := filepath.Join(dataDir, "config.json")
	dbPath := filepath.Join(dataDir, "app.db")

	cfg, err := config.Load(configPath)
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	db, err := index.Open(dbPath)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer db.Close()

	store := organize.NewStore(db)
	if err := store.SeedDefaultLibraries(); err != nil {
		log.Printf("seed libraries: %v", err)
	}

	// sync roots from config into DB
	for _, rc := range cfg.Roots {
		db.Exec(`INSERT OR IGNORE INTO roots(id,path,label,created_at) VALUES(?,?,?,?)`,
			rc.ID, rc.Path, rc.Label, time.Now().Unix())
	}

	// async startup scan
	scanner := index.NewScanner(db)
	syncer := index.NewSyncer(db)
	go func() {
		for _, rc := range cfg.Roots {
			log.Printf("scanning root: %s", rc.Path)
			if _, err := scanner.ScanRoot(rc.ID, rc.Path); err != nil {
				log.Printf("scan error (%s): %v", rc.Path, err)
			}
		}
		log.Printf("startup scan complete, rebuilding FTS")
		syncer.RebuildFTS()
	}()

	h := httpapi.NewHandler(cfg, db, dataDir)
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)

	srv := &http.Server{
		Addr:         addr,
		Handler:      h.Routes(),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 10 * time.Minute,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		log.Printf("files-dashboard listening on http://%s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	log.Println("shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
