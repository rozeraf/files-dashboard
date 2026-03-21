// internal/httpapi/router.go
package httpapi

import (
	"database/sql"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/rozeraf/files-dashboard/internal/config"
	"github.com/rozeraf/files-dashboard/internal/index"
	"github.com/rozeraf/files-dashboard/internal/organize"
)

type Handler struct {
	cfg     *config.Config
	db      *sql.DB
	scanner *index.Scanner
	syncer  *index.Syncer
	store   *organize.Store
	jobs    *JobStore
}

func NewHandler(cfg *config.Config, db *sql.DB) *Handler {
	return &Handler{
		cfg:     cfg,
		db:      db,
		scanner: index.NewScanner(db),
		syncer:  index.NewSyncer(db),
		store:   organize.NewStore(db),
		jobs:    NewJobStore(),
	}
}

func (h *Handler) Routes() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(DevCORS)

	r.Route("/api", func(r chi.Router) {
		// FS
		r.Route("/fs", func(r chi.Router) {
			r.Get("/roots", h.listRoots)
			r.Post("/roots", h.createRoot)
			r.Patch("/roots/{id}", h.updateRoot)
			r.Delete("/roots/{id}", h.deleteRoot)
			r.Get("/roots/{rootId}/entries", h.listEntries)
			r.Get("/entries/{id}", h.getEntry)
			r.Get("/entries/{id}/raw", h.rawEntry)
			r.Post("/entries/{id}/rename", h.renameEntry)
			r.Post("/entries/move", h.moveEntries)
			r.Delete("/entries", h.deleteEntries)
			r.Post("/directories", h.createDirectory)
			r.Post("/upload", h.uploadFile)
		})

		// Libraries
		r.Get("/libraries", h.listLibraries)
		r.Get("/libraries/{id}", h.getLibrary)
		r.Post("/libraries", h.createLibrary)
		r.Patch("/libraries/{id}", h.updateLibrary)
		r.Delete("/libraries/{id}", h.deleteLibrary)
		r.Get("/libraries/{id}/categories", h.categoryTree)

		// Categories
		r.Get("/categories/{id}", h.getCategory)
		r.Post("/categories", h.createCategory)
		r.Patch("/categories/{id}", h.updateCategory)
		r.Delete("/categories/{id}", h.deleteCategory)
		r.Get("/categories/{id}/entries", h.categoryEntries)
		r.Get("/categories/{id}/subcategories", h.listSubcategories)

		// Entry logical ops
		r.Post("/entries/{id}/categories", h.assignCategories)
		r.Post("/entries/{id}/tags", h.assignTags)
		r.Get("/entries/{id}", h.entryDetail)

		// Tags
		r.Get("/tags", h.listTags)
		r.Get("/tags/{id}", h.getTag)
		r.Post("/tags", h.createTag)
		r.Patch("/tags/{id}", h.updateTag)
		r.Delete("/tags/{id}", h.deleteTag)

		// Collections
		r.Get("/collections", h.listCollections)
		r.Get("/collections/{id}", h.getCollection)
		r.Post("/collections", h.createCollection)
		r.Patch("/collections/{id}", h.updateCollection)
		r.Delete("/collections/{id}", h.deleteCollection)
		r.Get("/collections/{id}/entries", h.collectionEntries)
		r.Post("/collections/{id}/entries", h.addToCollection)
		r.Delete("/collections/{id}/entries/{entryId}", h.removeFromCollection)
		r.Post("/collections/{id}/entries/reorder", h.reorderCollection)

		// Discovery
		r.Get("/favorites", h.listFavorites)
		r.Post("/favorites/{entryId}", h.addFavorite)
		r.Delete("/favorites/{entryId}", h.removeFavorite)
		r.Get("/recent", h.recentEntries)
		r.Get("/uncategorized", h.uncategorizedEntries)

		// Saved views
		r.Get("/saved-views", h.listSavedViews)
		r.Get("/saved-views/{id}", h.getSavedView)
		r.Post("/saved-views", h.createSavedView)
		r.Patch("/saved-views/{id}", h.updateSavedView)
		r.Delete("/saved-views/{id}", h.deleteSavedView)

		// Search
		r.Get("/search", h.search)

		// System
		r.Get("/config", h.getConfig)
		r.Patch("/config", h.updateConfig)
		r.Post("/scan", h.startScan)
		r.Get("/scan/{jobId}", h.scanStatus)
	})

	// SPA fallback
	r.Handle("/*", serveSPA())

	return r
}
