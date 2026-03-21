// internal/httpapi/tag_handlers.go
package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/rozeraf/files-dashboard/internal/model"
)

func (h *Handler) listTags(w http.ResponseWriter, r *http.Request) {
	tags, err := h.store.ListTags()
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	if tags == nil {
		tags = []model.Tag{}
	}
	writeJSON(w, 200, tags)
}

func (h *Handler) getTag(w http.ResponseWriter, r *http.Request) {
	tag, err := h.store.GetTag(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 404, "not found")
		return
	}
	writeJSON(w, 200, tag)
}

func (h *Handler) createTag(w http.ResponseWriter, r *http.Request) {
	var req model.CreateTagRequest
	if err := decode(r, &req); err != nil || req.Name == "" {
		writeError(w, 400, "name required")
		return
	}
	tag, err := h.store.CreateTag(req.Name, req.Color)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 201, tag)
}

func (h *Handler) updateTag(w http.ResponseWriter, r *http.Request) {
	var req model.UpdateTagRequest
	if err := decode(r, &req); err != nil {
		writeError(w, 400, "invalid body")
		return
	}
	color := ""
	if req.Color != nil {
		color = *req.Color
	}
	if err := h.store.UpdateTag(chi.URLParam(r, "id"), req.Name, color); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	w.WriteHeader(204)
}

func (h *Handler) deleteTag(w http.ResponseWriter, r *http.Request) {
	if err := h.store.DeleteTag(chi.URLParam(r, "id")); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	w.WriteHeader(204)
}

func (h *Handler) assignTags(w http.ResponseWriter, r *http.Request) {
	var req model.DeltaTagsRequest
	if err := decode(r, &req); err != nil {
		writeError(w, 400, "invalid body")
		return
	}
	entryID := chi.URLParam(r, "id")
	if err := h.store.AssignEntryTags(entryID, req.Add, req.Remove); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	h.syncer.UpdateFTSTags(entryID)
	w.WriteHeader(204)
}
