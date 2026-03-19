// internal/httpapi/scan_jobs.go
package httpapi

import (
	"sync"

	"github.com/rozeraf/files-dashboard/internal/model"
)

type JobStore struct {
	mu   sync.RWMutex
	jobs map[string]*model.ScanJobResponse
}

func NewJobStore() *JobStore {
	return &JobStore{jobs: map[string]*model.ScanJobResponse{}}
}

func (js *JobStore) Set(id string, j *model.ScanJobResponse) {
	js.mu.Lock()
	js.jobs[id] = j
	js.mu.Unlock()
}

func (js *JobStore) Get(id string) (*model.ScanJobResponse, bool) {
	js.mu.RLock()
	defer js.mu.RUnlock()
	j, ok := js.jobs[id]
	return j, ok
}
