// internal/httpapi/config_handlers.go
package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rozeraf/files-dashboard/internal/model"
)

func (h *Handler) getConfig(w http.ResponseWriter, r *http.Request) {
	resp := model.ConfigResponse{
		Host:       h.cfg.Host,
		Port:       h.cfg.Port,
		AppName:    h.cfg.AppName,
		LanEnabled: h.cfg.LanEnabled,
		Roots:      make([]model.RootRef, 0, len(h.cfg.Roots)),
	}
	for _, rc := range h.cfg.Roots {
		resp.Roots = append(resp.Roots, model.RootRef{ID: rc.ID, Path: rc.Path, Label: rc.Label})
	}
	writeJSON(w, 200, resp)
}

func (h *Handler) updateConfig(w http.ResponseWriter, r *http.Request) {
	var req model.UpdateConfigRequest
	if err := decode(r, &req); err != nil {
		writeError(w, 400, "invalid body")
		return
	}
	restartRequired := false
	if req.AppName != nil {
		h.cfg.AppName = *req.AppName
	}
	if req.Host != nil {
		h.cfg.Host = *req.Host
		restartRequired = true
	}
	if req.Port != nil {
		h.cfg.Port = *req.Port
		restartRequired = true
	}
	h.cfg.Save()
	writeJSON(w, 200, model.UpdateConfigResponse{RestartRequired: restartRequired})
}

func (h *Handler) startScan(w http.ResponseWriter, r *http.Request) {
	if !h.scanMu.TryLock() {
		writeError(w, 409, "scan already in progress")
		return
	}

	jobID := uuid.New().String()
	job := &model.ScanJobResponse{JobID: jobID, Status: "running"}
	h.jobs.Set(jobID, job)

	go func() {
		defer h.scanMu.Unlock()
		for _, rc := range h.cfg.Roots {
			stats, err := h.scanner.ScanRoot(rc.ID, rc.Path)
			if err != nil {
				job.Lock()
				job.Status = "error"
				job.Error = err.Error()
				job.Unlock()
				return
			}
			job.Lock()
			job.Scanned += stats.Scanned
			job.Added += stats.Added
			job.Unlock()
		}
		h.syncer.RebuildFTS()
		job.Lock()
		job.Status = "done"
		job.Unlock()
	}()

	writeJSON(w, 202, map[string]any{"jobId": jobID, "status": "running", "scanned": 0, "added": 0, "removed": 0})
}

func (h *Handler) scanStatus(w http.ResponseWriter, r *http.Request) {
	job, ok := h.jobs.Get(chi.URLParam(r, "jobId"))
	if !ok {
		writeError(w, 404, "job not found")
		return
	}
	job.Lock()
	defer job.Unlock()
	writeJSON(w, 200, job)
}
