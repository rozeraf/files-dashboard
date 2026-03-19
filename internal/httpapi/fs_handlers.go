// internal/httpapi/fs_handlers.go
package httpapi

import (
	"database/sql"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rozeraf/files-dashboard/internal/config"
	"github.com/rozeraf/files-dashboard/internal/fsops"
	"github.com/rozeraf/files-dashboard/internal/index"
	"github.com/rozeraf/files-dashboard/internal/model"
)

func (h *Handler) listRoots(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(`SELECT id,path,label,created_at FROM roots ORDER BY label`)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	defer rows.Close()
	var roots []model.Root
	for rows.Next() {
		var root model.Root
		rows.Scan(&root.ID, &root.Path, &root.Label, &root.CreatedAt)
		roots = append(roots, root)
	}
	if roots == nil {
		roots = []model.Root{}
	}
	writeJSON(w, 200, roots)
}

func (h *Handler) createRoot(w http.ResponseWriter, r *http.Request) {
	var req model.CreateRootRequest
	if err := decode(r, &req); err != nil {
		writeError(w, 400, "invalid body")
		return
	}
	if req.Path == "" || req.Label == "" {
		writeError(w, 400, "path and label required")
		return
	}
	clean := filepath.Clean(req.Path)
	if !isDir(clean) {
		writeError(w, 400, "path must be an existing directory")
		return
	}
	root := model.Root{ID: uuid.New().String(), Path: clean, Label: req.Label, CreatedAt: time.Now().Unix()}
	if _, err := h.db.Exec(`INSERT INTO roots(id,path,label,created_at) VALUES(?,?,?,?)`,
		root.ID, root.Path, root.Label, root.CreatedAt); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	h.cfg.Roots = append(h.cfg.Roots, config.RootConfig{ID: root.ID, Path: root.Path, Label: root.Label})
	h.cfg.Save()
	writeJSON(w, 201, root)
}

func (h *Handler) updateRoot(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req model.UpdateRootRequest
	if err := decode(r, &req); err != nil {
		writeError(w, 400, "invalid body")
		return
	}
	if _, err := h.db.Exec(`UPDATE roots SET label=? WHERE id=?`, req.Label, id); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	for i := range h.cfg.Roots {
		if h.cfg.Roots[i].ID == id {
			h.cfg.Roots[i].Label = req.Label
		}
	}
	h.cfg.Save()
	w.WriteHeader(204)
}

func (h *Handler) deleteRoot(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if _, err := h.db.Exec(`DELETE FROM roots WHERE id=?`, id); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	var newRoots []config.RootConfig
	for _, rc := range h.cfg.Roots {
		if rc.ID != id {
			newRoots = append(newRoots, rc)
		}
	}
	h.cfg.Roots = newRoots
	h.cfg.Save()
	w.WriteHeader(204)
}

func (h *Handler) listEntries(w http.ResponseWriter, r *http.Request) {
	rootID := chi.URLParam(r, "rootId")
	relPath := r.URL.Query().Get("path")

	var rootPath string
	if err := h.db.QueryRow(`SELECT path FROM roots WHERE id=?`, rootID).Scan(&rootPath); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, 404, "root not found")
			return
		}
		writeError(w, 500, err.Error())
		return
	}

	entries, err := fsops.ListDir(rootPath, relPath)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, entries)
}

func (h *Handler) getEntry(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	e, err := index.GetEntry(h.db, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, 404, "not found")
			return
		}
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, e)
}

func (h *Handler) rawEntry(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	absPath, err := index.EntryAbsPath(h.db, id)
	if err != nil {
		writeError(w, 404, "not found")
		return
	}
	http.ServeFile(w, r, absPath)
}

func (h *Handler) renameEntry(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req model.RenameRequest
	if err := decode(r, &req); err != nil || req.Name == "" {
		writeError(w, 400, "name required")
		return
	}

	var rootID, relPath, rootPath string
	h.db.QueryRow(`SELECT e.root_id, e.rel_path, r.path FROM entries e JOIN roots r ON r.id=e.root_id WHERE e.id=?`, id).
		Scan(&rootID, &relPath, &rootPath)

	if err := fsops.Rename(rootPath, relPath, req.Name); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	newRelPath := filepath.Join(filepath.Dir(relPath), req.Name)
	h.syncer.AfterRename(rootID, relPath, newRelPath)
	w.WriteHeader(204)
}

func (h *Handler) moveEntries(w http.ResponseWriter, r *http.Request) {
	var req model.MoveRequest
	if err := decode(r, &req); err != nil {
		writeError(w, 400, "invalid body")
		return
	}
	var destRootPath string
	h.db.QueryRow(`SELECT path FROM roots WHERE id=?`, req.DestRootID).Scan(&destRootPath)

	for _, id := range req.IDs {
		var srcRootPath, relPath string
		h.db.QueryRow(`SELECT r.path, e.rel_path FROM entries e JOIN roots r ON r.id=e.root_id WHERE e.id=?`, id).
			Scan(&srcRootPath, &relPath)
		if err := fsops.Move(srcRootPath, relPath, destRootPath, req.DestRelPath); err != nil {
			writeError(w, 500, err.Error())
			return
		}
		newRelPath := filepath.Join(req.DestRelPath, filepath.Base(relPath))
		h.syncer.AfterRename(req.DestRootID, relPath, newRelPath)
	}
	w.WriteHeader(204)
}

func (h *Handler) deleteEntries(w http.ResponseWriter, r *http.Request) {
	var req model.DeleteRequest
	if err := decode(r, &req); err != nil {
		writeError(w, 400, "invalid body")
		return
	}
	for _, id := range req.IDs {
		var rootPath, relPath string
		if err := h.db.QueryRow(`SELECT r.path, e.rel_path FROM entries e JOIN roots r ON r.id=e.root_id WHERE e.id=?`, id).
			Scan(&rootPath, &relPath); err != nil {
			continue
		}
		fsops.Delete(rootPath, relPath) // nolint - best effort
		h.syncer.AfterDelete([]string{id})
	}
	w.WriteHeader(204)
}

func (h *Handler) createDirectory(w http.ResponseWriter, r *http.Request) {
	var req model.CreateDirectoryRequest
	if err := decode(r, &req); err != nil {
		writeError(w, 400, "invalid body")
		return
	}
	var rootPath string
	h.db.QueryRow(`SELECT path FROM roots WHERE id=?`, req.RootID).Scan(&rootPath)

	relPath := filepath.Join(req.RelPath, req.Name)
	if err := fsops.Mkdir(rootPath, relPath); err != nil {
		writeError(w, 500, err.Error())
		return
	}

	e := model.Entry{RelPath: relPath, ParentRelPath: req.RelPath, Name: req.Name, Kind: "dir", Mtime: time.Now().Unix()}
	h.syncer.AddEntry(req.RootID, e)
	w.WriteHeader(201)
}

func (h *Handler) uploadFile(w http.ResponseWriter, r *http.Request) {
	r.ParseMultipartForm(100 << 20) // 100 MB
	rootID := r.FormValue("rootId")
	relPath := r.FormValue("relPath")

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, 400, "file required")
		return
	}
	defer file.Close()

	var rootPath string
	h.db.QueryRow(`SELECT path FROM roots WHERE id=?`, rootID).Scan(&rootPath)

	savedRelPath, err := fsops.SaveUpload(rootPath, relPath, header.Filename, file)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	entries, _ := fsops.ListDir(rootPath, relPath)
	for _, e := range entries {
		if e.RelPath == savedRelPath {
			id, _ := h.syncer.AddEntry(rootID, e)
			e.ID = id
			writeJSON(w, 201, e)
			return
		}
	}
	w.WriteHeader(201)
}

func isDir(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}
