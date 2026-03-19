// internal/httpapi/library_handlers.go
package httpapi

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/rozeraf/files-dashboard/internal/model"
	"github.com/rozeraf/files-dashboard/internal/organize"
)

func (h *Handler) listLibraries(w http.ResponseWriter, r *http.Request) {
	libs, err := h.store.ListLibraries()
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	if libs == nil {
		libs = []model.Library{}
	}
	writeJSON(w, 200, libs)
}

func (h *Handler) getLibrary(w http.ResponseWriter, r *http.Request) {
	lib, err := h.store.GetLibrary(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 404, "not found")
		return
	}
	writeJSON(w, 200, lib)
}

func (h *Handler) createLibrary(w http.ResponseWriter, r *http.Request) {
	var req model.CreateLibraryRequest
	if err := decode(r, &req); err != nil || req.Name == "" {
		writeError(w, 400, "name required")
		return
	}
	lib, err := h.store.CreateLibrary(req.Name, req.Icon)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 201, lib)
}

func (h *Handler) updateLibrary(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req model.UpdateLibraryRequest
	if err := decode(r, &req); err != nil {
		writeError(w, 400, "invalid body")
		return
	}
	h.store.UpdateLibrary(id, func(u *organize.LibraryUpdate) {
		u.Name = req.Name
		u.Icon = req.Icon
		u.Position = req.Position
	})
	w.WriteHeader(204)
}

func (h *Handler) deleteLibrary(w http.ResponseWriter, r *http.Request) {
	if err := h.store.DeleteLibrary(chi.URLParam(r, "id")); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	w.WriteHeader(204)
}

func (h *Handler) categoryTree(w http.ResponseWriter, r *http.Request) {
	tree, err := h.store.CategoryTree(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	if tree == nil {
		tree = []*model.Category{}
	}
	writeJSON(w, 200, tree)
}

func (h *Handler) createCategory(w http.ResponseWriter, r *http.Request) {
	var req model.CreateCategoryRequest
	if err := decode(r, &req); err != nil || req.Name == "" || req.LibraryID == "" {
		writeError(w, 400, "libraryId and name required")
		return
	}
	cat, err := h.store.CreateCategory(req.LibraryID, req.ParentID, req.Name)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 201, cat)
}

func (h *Handler) updateCategory(w http.ResponseWriter, r *http.Request) {
	var req model.UpdateCategoryRequest
	if err := decode(r, &req); err != nil {
		writeError(w, 400, "invalid body")
		return
	}
	h.store.UpdateCategory(chi.URLParam(r, "id"), req.Name, req.ParentID, req.Position)
	w.WriteHeader(204)
}

func (h *Handler) deleteCategory(w http.ResponseWriter, r *http.Request) {
	h.store.DeleteCategory(chi.URLParam(r, "id"))
	w.WriteHeader(204)
}

func (h *Handler) categoryEntries(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	entries, total, err := h.store.CategoryEntries(chi.URLParam(r, "id"), page, limit)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	if entries == nil {
		entries = []model.Entry{}
	}
	writeJSON(w, 200, model.PagedResponse[model.Entry]{Items: entries, Total: total, Page: page, Limit: limit})
}

func (h *Handler) assignCategories(w http.ResponseWriter, r *http.Request) {
	var req model.DeltaCategoriesRequest
	if err := decode(r, &req); err != nil {
		writeError(w, 400, "invalid body")
		return
	}
	entryID := chi.URLParam(r, "id")
	if err := h.store.AssignEntryCategories(entryID, req.Add, req.Remove); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	h.syncer.UpdateFTSCategories(entryID)
	w.WriteHeader(204)
}
