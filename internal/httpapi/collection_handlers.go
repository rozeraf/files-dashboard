// internal/httpapi/collection_handlers.go
package httpapi

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/rozeraf/files-dashboard/internal/model"
)

func (h *Handler) listCollections(w http.ResponseWriter, r *http.Request) {
	cols, err := h.store.ListCollections()
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	if cols == nil {
		cols = []model.Collection{}
	}
	writeJSON(w, 200, cols)
}

func (h *Handler) getCollection(w http.ResponseWriter, r *http.Request) {
	col, err := h.store.GetCollection(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 404, "not found")
		return
	}
	writeJSON(w, 200, col)
}

func (h *Handler) createCollection(w http.ResponseWriter, r *http.Request) {
	var req model.CreateCollectionRequest
	if err := decode(r, &req); err != nil || req.Name == "" {
		writeError(w, 400, "name required")
		return
	}
	col, err := h.store.CreateCollection(req.Name, req.Description)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 201, col)
}

func (h *Handler) updateCollection(w http.ResponseWriter, r *http.Request) {
	var req model.UpdateCollectionRequest
	if err := decode(r, &req); err != nil {
		writeError(w, 400, "invalid body")
		return
	}
	h.store.UpdateCollection(chi.URLParam(r, "id"), req.Name, req.Description)
	w.WriteHeader(204)
}

func (h *Handler) deleteCollection(w http.ResponseWriter, r *http.Request) {
	h.store.DeleteCollection(chi.URLParam(r, "id"))
	w.WriteHeader(204)
}

func (h *Handler) collectionEntries(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	entries, total, err := h.store.CollectionEntries(chi.URLParam(r, "id"), page, limit)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	if entries == nil {
		entries = []model.Entry{}
	}
	writeJSON(w, 200, model.PagedResponse[model.Entry]{Items: entries, Total: total, Page: page, Limit: limit})
}

func (h *Handler) addToCollection(w http.ResponseWriter, r *http.Request) {
	var req model.AddToCollectionRequest
	if err := decode(r, &req); err != nil || req.EntryID == "" {
		writeError(w, 400, "entryId required")
		return
	}
	h.store.AddToCollection(chi.URLParam(r, "id"), req.EntryID)
	w.WriteHeader(200)
}

func (h *Handler) removeFromCollection(w http.ResponseWriter, r *http.Request) {
	h.store.RemoveFromCollection(chi.URLParam(r, "id"), chi.URLParam(r, "entryId"))
	w.WriteHeader(204)
}

func (h *Handler) reorderCollection(w http.ResponseWriter, r *http.Request) {
	var req model.ReorderCollectionRequest
	if err := decode(r, &req); err != nil {
		writeError(w, 400, "invalid body")
		return
	}
	if err := h.store.ReorderCollection(chi.URLParam(r, "id"), req.Order); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	w.WriteHeader(204)
}
