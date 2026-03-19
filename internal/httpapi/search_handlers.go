// internal/httpapi/search_handlers.go
package httpapi

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/rozeraf/files-dashboard/internal/index"
	"github.com/rozeraf/files-dashboard/internal/model"
)

func (h *Handler) search(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	tags := []string{}
	if t := q.Get("tags"); t != "" {
		tags = strings.Split(t, ",")
	}
	sizeMin, _ := strconv.ParseInt(q.Get("size_min"), 10, 64)
	sizeMax, _ := strconv.ParseInt(q.Get("size_max"), 10, 64)
	since, _ := strconv.ParseInt(q.Get("since"), 10, 64)
	page, _ := strconv.Atoi(q.Get("page"))
	limit, _ := strconv.Atoi(q.Get("limit"))

	params := index.SearchParams{
		LibraryID:  q.Get("libraryId"),
		CategoryID: q.Get("categoryId"),
		Tags:       tags,
		Ext:        q.Get("ext"),
		Kind:       q.Get("kind"),
		Since:      since,
		SizeMin:    sizeMin,
		SizeMax:    sizeMax,
		Status:     q.Get("status"),
		Page:       page,
		Limit:      limit,
	}

	results, err := h.syncer.Search(q.Get("q"), params)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	if results == nil {
		results = []model.Entry{}
	}
	writeJSON(w, 200, results)
}

func (h *Handler) entryDetail(w http.ResponseWriter, r *http.Request) {
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
	detail := model.EntryDetail{Entry: e}

	// categories
	catRows, _ := h.db.Query(`SELECT c.id,c.library_id,c.parent_id,c.name,c.slug,c.position,c.created_at
		FROM categories c JOIN entry_categories ec ON ec.category_id=c.id WHERE ec.entry_id=?`, id)
	for catRows.Next() {
		var c model.Category
		catRows.Scan(&c.ID, &c.LibraryID, &c.ParentID, &c.Name, &c.Slug, &c.Position, &c.CreatedAt)
		detail.Categories = append(detail.Categories, c)
	}
	catRows.Close()
	if detail.Categories == nil {
		detail.Categories = []model.Category{}
	}

	// tags
	tagRows, _ := h.db.Query(`SELECT t.id,t.name,t.color FROM tags t JOIN entry_tags et ON et.tag_id=t.id WHERE et.entry_id=?`, id)
	for tagRows.Next() {
		var t model.Tag
		tagRows.Scan(&t.ID, &t.Name, &t.Color)
		detail.Tags = append(detail.Tags, t)
	}
	tagRows.Close()
	if detail.Tags == nil {
		detail.Tags = []model.Tag{}
	}

	// collections
	colRows, _ := h.db.Query(`SELECT c.id,c.name FROM collections c JOIN collection_entries ce ON ce.collection_id=c.id WHERE ce.entry_id=?`, id)
	for colRows.Next() {
		var c model.CollectionRef
		colRows.Scan(&c.ID, &c.Name)
		detail.Collections = append(detail.Collections, c)
	}
	colRows.Close()
	if detail.Collections == nil {
		detail.Collections = []model.CollectionRef{}
	}

	// favorited
	var favCount int
	h.db.QueryRow(`SELECT COUNT(*) FROM favorites WHERE entry_id=?`, id).Scan(&favCount)
	detail.Favorited = favCount > 0

	writeJSON(w, 200, detail)
}
