// internal/httpapi/organize_handlers.go
package httpapi

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/rozeraf/files-dashboard/internal/model"
)

func (h *Handler) listFavorites(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	entries, err := h.store.ListFavorites(limit)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	if entries == nil {
		entries = []model.Entry{}
	}
	writeJSON(w, 200, entries)
}

func (h *Handler) addFavorite(w http.ResponseWriter, r *http.Request) {
	h.store.AddFavorite(chi.URLParam(r, "entryId"))
	w.WriteHeader(200)
}

func (h *Handler) removeFavorite(w http.ResponseWriter, r *http.Request) {
	h.store.RemoveFavorite(chi.URLParam(r, "entryId"))
	w.WriteHeader(204)
}

func (h *Handler) recentEntries(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	entries, err := h.store.RecentEntries(limit)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	if entries == nil {
		entries = []model.Entry{}
	}
	writeJSON(w, 200, entries)
}

func (h *Handler) uncategorizedEntries(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	entries, total, err := h.store.UncategorizedEntries(page, limit)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	if entries == nil {
		entries = []model.Entry{}
	}
	writeJSON(w, 200, model.PagedResponse[model.Entry]{Items: entries, Total: total, Page: page, Limit: limit})
}

func (h *Handler) listSavedViews(w http.ResponseWriter, r *http.Request) {
	views, err := h.store.ListSavedViews()
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	if views == nil {
		views = []model.SavedView{}
	}
	writeJSON(w, 200, views)
}

func (h *Handler) getSavedView(w http.ResponseWriter, r *http.Request) {
	v, err := h.store.GetSavedView(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 404, "not found")
		return
	}
	writeJSON(w, 200, v)
}

func (h *Handler) createSavedView(w http.ResponseWriter, r *http.Request) {
	var req model.CreateSavedViewRequest
	if err := decode(r, &req); err != nil || req.Name == "" {
		writeError(w, 400, "name required")
		return
	}
	filtersJSON, _ := json.Marshal(req.Filters)
	v, err := h.store.CreateSavedView(req.Name, string(filtersJSON))
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 201, v)
}

func (h *Handler) updateSavedView(w http.ResponseWriter, r *http.Request) {
	var req model.UpdateSavedViewRequest
	if err := decode(r, &req); err != nil {
		writeError(w, 400, "invalid body")
		return
	}
	var filtersJSON *string
	if req.Filters != nil {
		b, _ := json.Marshal(req.Filters)
		s := string(b)
		filtersJSON = &s
	}
	h.store.UpdateSavedView(chi.URLParam(r, "id"), req.Name, filtersJSON)
	w.WriteHeader(204)
}

func (h *Handler) deleteSavedView(w http.ResponseWriter, r *http.Request) {
	h.store.DeleteSavedView(chi.URLParam(r, "id"))
	w.WriteHeader(204)
}
