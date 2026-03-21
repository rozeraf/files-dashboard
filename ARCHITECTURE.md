# Architecture

files-dashboard is a self-hosted personal file manager. A single Go binary embeds a React SPA and serves it alongside a REST API backed by SQLite. No external services, no Docker, no CGO.

---

## Table of Contents

1. [High-level overview](#1-high-level-overview)
2. [Directory layout](#2-directory-layout)
3. [Backend layers](#3-backend-layers)
   - [Entry point (main.go)](#31-entry-point-maingo)
   - [Config](#32-config)
   - [Database / index](#33-database--index)
   - [fsops — filesystem operations](#34-fsops--filesystem-operations)
   - [Scanner](#35-scanner)
   - [Syncer](#36-syncer)
   - [Search (FTS5)](#37-search-fts5)
   - [Organize layer](#38-organize-layer)
   - [HTTP API](#39-http-api)
4. [Scan jobs](#4-scan-jobs)
5. [Frontend layers](#5-frontend-layers)
6. [Database schema](#6-database-schema)
7. [Data model: physical vs logical](#7-data-model-physical-vs-logical)
8. [Build & distribution](#8-build--distribution)
9. [Security considerations](#9-security-considerations)
10. [Known limitations / non-goals](#10-known-limitations--non-goals)

---

## 1. High-level overview

```
┌────────────────────────────────────────────────────┐
│  Browser                                           │
│  React 18 + Vite + Tailwind v4 + shadcn/ui        │
│  TanStack Query (server state) · Zustand (UI state)│
└────────────────┬───────────────────────────────────┘
                 │ HTTP / REST  (same origin or LAN)
┌────────────────▼───────────────────────────────────┐
│  Go HTTP server  (chi router)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ fs/      │ │organize/ │ │ search   │           │
│  │ handlers │ │ handlers │ │ handler  │           │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘           │
│       │            │            │                  │
│  ┌────▼──────┐ ┌───▼──────┐ ┌──▼───────────┐      │
│  │  fsops   │ │ organize │ │  index       │      │
│  │ SafeJoin │ │  Store   │ │ Scanner      │      │
│  │ ListDir  │ │  CRUD    │ │ Syncer       │      │
│  │ WalkRoot │ │          │ │ Search (FTS5)│      │
│  └────┬─────┘ └──────────┘ └──────────────┘      │
│       │                           │               │
│  ┌────▼───────────────────────────▼─────────┐     │
│  │         SQLite  (WAL mode)               │     │
│  │  entries · libraries · categories · tags │     │
│  │  collections · favorites · saved_views   │     │
│  │  entries_fts  (FTS5 virtual table)       │     │
│  └──────────────────────────────────────────┘     │
└────────────────────────────────────────────────────┘
        │
   Filesystem (roots — arbitrary local directories)
```

---

## 2. Directory layout

```
files-dashboard/
├── cmd/app/main.go          # binary entry point
├── internal/
│   ├── config/              # JSON config load/save
│   ├── fsops/               # safe filesystem primitives
│   ├── index/               # SQLite schema, scanner, syncer, FTS search
│   ├── model/               # shared Go structs (Entry, Library, …)
│   ├── organize/            # libraries/categories/tags/collections CRUD
│   └── httpapi/             # chi router, all HTTP handlers
├── web/                     # frontend (Vite + React + TypeScript)
│   └── src/
│       ├── lib/api.ts       # typed fetch client
│       ├── store/           # Zustand stores
│       ├── components/      # UI components + layout
│       └── pages/           # one file per route
├── data/                    # runtime data (gitignored)
│   ├── config.json
│   └── app.db
└── Makefile
```

---

## 3. Backend layers

### 3.1 Entry point (main.go)

`cmd/app/main.go` wires everything together at startup:

1. Reads `DATA_DIR` env (default `data/`) to locate `config.json` and `app.db`.
2. Loads config (creates defaults if missing).
3. Opens SQLite, runs schema migrations.
4. Seeds default libraries (via `organize.Store.SeedDefaultLibraries`).
5. Syncs roots from config into the `roots` table (`INSERT OR IGNORE`).
6. Launches an async startup scan (goroutine) that walks all configured roots and rebuilds FTS.
7. Starts the HTTP server with 10-second graceful shutdown.

Timeouts: ReadTimeout 30s, WriteTimeout 60s (allows large file downloads), IdleTimeout 120s.

### 3.2 Config

`internal/config/config.go` — plain JSON at `data/config.json`.

```json
{
  "host": "127.0.0.1",
  "port": 4537,
  "app_name": "files-dashboard",
  "lan_enabled": false,
  "roots": [
    { "id": "uuid", "path": "/home/user/files", "label": "Files" }
  ]
}
```

**Atomic writes**: `Save()` writes to a `.tmp` file then `os.Rename`, which is atomic on POSIX. Protected by a `sync.Mutex` so concurrent saves don't corrupt the file.

**`lan_enabled` flag**: purely informational in the config. The actual bind address comes from `cfg.Host`. To expose on LAN, set `host: "0.0.0.0"` — there is no special code path for `lan_enabled`. See [Security considerations](#9-security-considerations).

### 3.3 Database / index

`internal/index/db.go` opens SQLite via `modernc.org/sqlite` (pure Go, no CGO) with:

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA cache_size = -32768;  -- 32 MB page cache
```

WAL mode allows concurrent reads while a write is in progress. Foreign keys are enforced, so deleting a root cascades to its entries, which cascades to all junction tables.

Schema is applied by `migrate()` which runs the full DDL with `IF NOT EXISTS` — no migration versioning, idempotent.

### 3.4 fsops — filesystem operations

`internal/fsops/fsops.go` is the only layer that touches the real filesystem. **Every operation goes through `SafeJoin` first.**

```go
func SafeJoin(root, relPath string) (string, error) {
    joined := filepath.Clean(filepath.Join(root, relPath))
    if !strings.HasPrefix(joined+string(filepath.Separator), root+string(filepath.Separator)) {
        return "", ErrOutsideRoot
    }
    return joined, nil
}
```

The trailing-separator trick (`root+sep`) prevents a root of `/data/foo` from accidentally accepting `/data/foobar`. This covers:

- `../` traversal — `filepath.Clean` collapses it, prefix check rejects it.
- Null bytes — `filepath.Clean` handles them.
- Symlinks pointing outside root — **not** handled; `SafeJoin` only validates the lexical path, not the resolved path. If a symlink inside a root points outside, it will be followed.

Public functions and their protections:

| Function | SafeJoin calls | Extra check |
|---|---|---|
| `ListDir` | source dir | — |
| `Mkdir` | target | — |
| `Rename` | src + dst | `newName` must not contain `filepath.Separator` |
| `Move` | src + dst | dst is `dstRoot/dstRelPath/basename(src)` |
| `Delete` | target | uses `os.RemoveAll` (recursive) |
| `SaveUpload` | dest dir | filename sanitized with `filepath.Base` |
| `WalkRoot` | — | used only by scanner on trusted root paths |

MIME detection: reads first 512 bytes via `http.DetectContentType` (Go stdlib sniff), falls back to `mime.TypeByExtension`.

### 3.5 Scanner

`internal/index/scanner.go` — `ScanRoot(rootID, rootPath)`:

1. Calls `fsops.WalkRoot(rootPath)` — recursive `filepath.Walk`.
2. `UPDATE entries SET missing=1 WHERE root_id=?` — marks all existing entries as potentially gone.
3. For each discovered file/dir:
   - `SELECT id FROM entries WHERE root_id=? AND rel_path=?`
   - **New**: `INSERT` with fresh UUID, insert into FTS.
   - **Existing**: `UPDATE missing=0, mtime, size, updated_at`.
4. After the loop, entries that are still `missing=1` were not found on disk (deleted externally).

This is an **incremental scan by rel_path identity** — not a full rebuild. Files that move between directories appear as: old path marked missing + new path inserted as new entry. Logical metadata (categories, tags) attached to the old entry is lost in that case.

The scanner does **not** use file watchers (no `fsnotify`). Re-scanning is triggered by:
- Startup (async goroutine).
- `POST /api/scan` (user-initiated, async, returns job ID).

### 3.6 Syncer

`internal/index/sync.go` — handles DB consistency after in-app filesystem mutations (rename, move, delete, upload). Called by HTTP handlers after `fsops` operations succeed.

| Method | What it does |
|---|---|
| `AddEntry(rootID, entry)` | INSERT into `entries` + FTS insert |
| `AfterRename(rootID, oldRel, newRel)` | UPDATE rel_path/parent_rel_path for entry + all descendants (LIKE `oldRel/%`), then FTS update — in a single transaction |
| `AfterDelete(ids)` | DELETE from `entries_fts` by rowid, then DELETE from `entries` |
| `UpdateFTSTags(entryID)` | Re-aggregate tag names → update `all_tags` FTS column |
| `UpdateFTSCategories(entryID)` | Re-aggregate category names → update `all_categories` FTS column |
| `RebuildFTS()` | Full FTS rebuild: DELETE all FTS rows, re-insert from `entries` with aggregated tags/categories |

**AfterRename subtree update**: uses `LIKE oldRel/%` to find descendants. This is a string prefix scan, not indexed by a B-tree path index. For deep directories with many children it does N individual `UPDATE` statements. Acceptable for personal use.

**FTS5 contentless table**: `content=''` means the FTS index stores no original text — only the tokenized index. Queries work, but `HIGHLIGHT()` and `SNIPPET()` functions are unavailable. Updates require delete-then-reinsert (not a simple `UPDATE`).

### 3.7 Search (FTS5)

`internal/index/search.go` — `Syncer.Search(q string, p SearchParams)` builds a dynamic SQL query:

- If `q != ""`: joins `entries_fts` and uses `entries_fts MATCH ?` with prefix matching (`q+"*"`).
- Filters are additive (all ANDed): library, category, tags (IN), ext, kind, since (updated_at), size range, status (favorite/uncategorized/missing).
- Returns `entries` rows (full metadata), not FTS snippet data.
- Default page size: 50, offset-based pagination.

The query is constructed by appending to `joins []string` and `wheres []string` slices, then joined with spaces and `AND`. Args are positional `?`. No ORM.

### 3.8 Organize layer

`internal/organize/` — `Store` wraps `*sql.DB`. All public methods are plain SQL.

**Libraries** (`library.go`): `CreateLibrary`, `GetLibrary`, `ListLibraries`, `UpdateLibrary`, `DeleteLibrary`. `CategoryTree` returns a nested `[]CategoryNode` built by loading all categories for a library and building parent→children map in Go (not recursive CTE). `AssignEntryCategories(entryID, add, remove []string)` runs in a transaction.

**Tags** (`tag.go`): flat tag CRUD + `AssignEntryTags`. After assignment, calls `syncer.UpdateFTSTags` to keep FTS in sync.

**Collections** (`collection.go`): CRUD + `AddToCollection`, `RemoveFromCollection`, `ReorderCollection` (updates `position` field).

**Favorites** (`tag.go`): `AddFavorite`, `RemoveFavorite`, `IsFavorited`, `ListFavorites(limit)` — ordered by `created_at DESC`.

**Discovery** (`favorites.go`): `RecentEntries(limit)` — `ORDER BY updated_at DESC`. `UncategorizedEntries()` — `NOT EXISTS (SELECT 1 FROM entry_categories WHERE entry_id=e.id)`.

**Saved views** (`views.go`): stores search filter params as a JSON blob (`filters TEXT`). Created from the Search page UI.

### 3.9 HTTP API

`internal/httpapi/router.go` — chi v5 router with three middlewares: `Logger`, `Recoverer`, `DevCORS`.

**DevCORS**: sets `Access-Control-Allow-Origin: *` and allows all methods. Named "Dev" but active in production — intended for single-user local use.

**Handler struct**:
```go
type Handler struct {
    cfg     *config.Config
    db      *sql.DB
    scanner *index.Scanner
    syncer  *index.Syncer
    store   *organize.Store
    jobs    *JobStore
}
```

**SPA serving**: `r.Handle("/*", serveSPA())` catches all non-API paths and serves the embedded `index.html` — enables client-side routing in React Router.

**Static embedding**: the compiled frontend (`web/dist/`) is embedded into the binary via `//go:embed` in `internal/httpapi/static.go`. The Makefile runs `bun build` first, copies the output, then `go build`.

Full route table:

```
GET    /api/fs/roots
POST   /api/fs/roots
PATCH  /api/fs/roots/{id}
DELETE /api/fs/roots/{id}
GET    /api/fs/roots/{rootId}/entries   ← lists one directory level
GET    /api/fs/entries/{id}
GET    /api/fs/entries/{id}/raw         ← file download / media streaming
POST   /api/fs/entries/{id}/rename
POST   /api/fs/entries/move
DELETE /api/fs/entries
POST   /api/fs/directories
POST   /api/fs/upload

GET/POST          /api/libraries
GET/PATCH/DELETE  /api/libraries/{id}
GET               /api/libraries/{id}/categories

GET               /api/categories/{id}
POST              /api/categories
PATCH/DELETE      /api/categories/{id}
GET               /api/categories/{id}/entries

POST              /api/entries/{id}/categories
POST              /api/entries/{id}/tags
GET               /api/entries/{id}           ← EntryDetail (with categories/tags/collections)

GET/POST          /api/tags
GET/PATCH/DELETE  /api/tags/{id}

GET/POST          /api/collections
GET/PATCH/DELETE  /api/collections/{id}
GET               /api/collections/{id}/entries
POST              /api/collections/{id}/entries
DELETE            /api/collections/{id}/entries/{entryId}
POST              /api/collections/{id}/entries/reorder

GET               /api/favorites
POST/DELETE       /api/favorites/{entryId}
GET               /api/recent
GET               /api/uncategorized

GET/POST          /api/saved-views
GET/PATCH/DELETE  /api/saved-views/{id}

GET               /api/search

GET               /api/config
PATCH             /api/config
POST              /api/scan
GET               /api/scan/{jobId}
```

---

## 4. Scan jobs

`POST /api/scan` creates a scan job and returns 202 immediately:

```go
jobID := uuid.New().String()
job := &model.ScanJobResponse{JobID: jobID, Status: "running"}
h.jobs.Set(jobID, job)

go func() {
    for _, rc := range h.cfg.Roots {
        stats, err := h.scanner.ScanRoot(rc.ID, rc.Path)
        job.Lock(); job.Scanned += stats.Scanned; job.Added += stats.Added; job.Unlock()
    }
    h.syncer.RebuildFTS()
    job.Lock(); job.Status = "done"; job.Unlock()
}()
```

**Concurrency**: `JobStore` uses `sync.RWMutex` for concurrent map access. Each `ScanJobResponse` embeds its own `sync.Mutex` for field updates. The goroutine and the polling handler safely read/write `Status`, `Scanned`, `Added`.

**Concurrent scan launches**: there is **no mutex preventing two `POST /api/scan` calls from running simultaneously**. Two concurrent scans on the same root will both call `UPDATE entries SET missing=1 WHERE root_id=?` and race on inserts/updates. This is a known limitation — acceptable for personal use where concurrent scan triggers are unlikely, but worth noting.

**FTS rebuild**: called once after all roots are scanned. If the scan goroutine fails partway through (one root errors), FTS rebuild is skipped.

**Job persistence**: jobs live only in memory (`JobStore` map). A server restart clears all jobs; polling a stale job ID returns 404.

---

## 5. Frontend layers

```
web/src/
├── main.tsx              # React root, QueryClient, Router, theme init
├── App.tsx               # route definitions
├── lib/
│   └── api.ts            # typed fetch client (all endpoints)
├── store/
│   └── ui.ts             # Zustand: theme, sidebarOpen, selectedIds, selectEntry, clearSelection
├── components/
│   ├── layout/
│   │   ├── Shell.tsx     # outer layout: Sidebar + Header + <Outlet>
│   │   ├── Sidebar.tsx   # navigation tree
│   │   ├── Header.tsx    # search bar + theme toggle
│   │   └── SelectionToolbar.tsx  # floating bulk-action bar
│   └── ui/               # shadcn/ui + custom components
│       ├── EntryGrid.tsx     # card grid with selection + Lightbox trigger
│       ├── EntryTable.tsx    # table view with selection + Lightbox trigger
│       ├── EntryDetailPanel.tsx  # right-side slide-in: metadata, categories, tags, collections
│       └── Lightbox.tsx      # full-screen image/video viewer with queue sidebar
└── pages/                # one component per route
    ├── HomePage.tsx
    ├── LibraryPage.tsx
    ├── CategoryPage.tsx
    ├── TagsPage.tsx
    ├── CollectionsPage.tsx
    ├── CollectionDetailPage.tsx
    ├── FilesPage.tsx
    ├── FavoritesPage.tsx
    ├── RecentPage.tsx
    ├── UncategorizedPage.tsx
    ├── SearchPage.tsx
    ├── SavedViewsPage.tsx
    └── SettingsPage.tsx
```

**State management**:
- **Server state**: TanStack Query v5. Each query has a stable `queryKey`. Mutations call `qc.invalidateQueries()` to refetch affected data.
- **UI state**: Zustand `useUI` store — theme (light/dark, persisted to `localStorage`), sidebar open/close, `selectedIds: Set<string>` for multi-select, `selectEntry` (toggle), `clearSelection`.

**Selection + bulk actions**: `EntryGrid` and `EntryTable` show a checkbox on hover that calls `selectEntry(id)`. When `selectedIds.size > 0`, `SelectionToolbar` (rendered in `Shell.tsx`) appears as a floating pill with a Delete button. Delete calls `DELETE /api/fs/entries` with all selected IDs, then invalidates all queries and clears selection.

**Media viewer (Lightbox)**: click any image or video in a grid/table opens `Lightbox.tsx`. Images show centered with prev/next arrows. Videos use a custom `VideoPlayer` inner component:
- Controls: play/pause, seek bar (20px hit area / 4px visual), volume, speed cycling (1×→1.25×→1.5×→2×), fullscreen.
- Controls auto-hide after 3 seconds of inactivity, reappear on mouse move or space.
- Keyboard: `Space` play/pause, `M` mute, `F` fullscreen, `←/→` seek ±5s.
- Queue sidebar: playlist of all entries in the current view with active indicator.

**Lightbox keyboard routing**: the global keydown handler in `Lightbox` only handles `Escape` and arrow keys for navigation (prev/next entry). When a `VideoPlayer` is active, `←/→` are consumed by `VideoPlayer` for seeking and do not propagate to the Lightbox navigation handler.

---

## 6. Database schema

```sql
-- Physical layer
CREATE TABLE roots (
    id TEXT PRIMARY KEY, path TEXT UNIQUE NOT NULL, label TEXT NOT NULL, created_at INTEGER
);

CREATE TABLE entries (
    id TEXT PRIMARY KEY,
    root_id TEXT NOT NULL REFERENCES roots(id) ON DELETE CASCADE,
    rel_path TEXT NOT NULL,          -- e.g. "photos/2026/img001.jpg"
    parent_rel_path TEXT NOT NULL,   -- e.g. "photos/2026"
    name TEXT NOT NULL,              -- e.g. "img001.jpg"
    kind TEXT NOT NULL,              -- "file" | "dir"
    size INTEGER,                    -- NULL for dirs
    mtime INTEGER NOT NULL,          -- Unix timestamp
    ext TEXT NOT NULL DEFAULT '',    -- e.g. "jpg"
    mime TEXT NOT NULL DEFAULT '',   -- e.g. "image/jpeg"
    missing INTEGER NOT NULL DEFAULT 0,  -- 1 = file gone from disk
    updated_at INTEGER NOT NULL,
    UNIQUE(root_id, rel_path)
);

CREATE INDEX idx_entries_root_parent ON entries(root_id, parent_rel_path);
CREATE INDEX idx_entries_kind        ON entries(kind);
CREATE INDEX idx_entries_missing     ON entries(missing);
CREATE INDEX idx_entries_updated     ON entries(updated_at);

-- Logical layer
CREATE TABLE libraries (
    id TEXT PRIMARY KEY, name TEXT, slug TEXT UNIQUE, icon TEXT, position INTEGER, created_at INTEGER
);

CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    library_id TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    parent_id TEXT REFERENCES categories(id) ON DELETE CASCADE,  -- supports nesting
    name TEXT, slug TEXT, position INTEGER, created_at INTEGER,
    UNIQUE(library_id, slug)
);

CREATE TABLE entry_categories (
    entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (entry_id, category_id)
);

CREATE TABLE tags (
    id TEXT PRIMARY KEY, name TEXT UNIQUE, color TEXT DEFAULT ''
);

CREATE TABLE entry_tags (
    entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (entry_id, tag_id)
);

CREATE TABLE collections (
    id TEXT PRIMARY KEY, name TEXT, description TEXT DEFAULT '', created_at INTEGER
);

CREATE TABLE collection_entries (
    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,
    PRIMARY KEY (collection_id, entry_id)
);

CREATE TABLE favorites (
    entry_id TEXT PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE,
    created_at INTEGER
);

CREATE TABLE saved_views (
    id TEXT PRIMARY KEY, name TEXT, filters TEXT DEFAULT '{}', created_at INTEGER
);

-- Full-text search (contentless — no stored text, only index)
CREATE VIRTUAL TABLE entries_fts USING fts5(
    name, rel_path, ext, all_tags, all_categories,
    content=''
);
```

All foreign keys `ON DELETE CASCADE` — deleting a root removes all its entries, which removes all their tags/categories/favorites/collection memberships.

---

## 7. Data model: physical vs logical

The core design tension: files live on disk (physical), but users organize them with libraries/categories/tags (logical).

**Physical identity**: `(root_id, rel_path)` is the unique key for an entry. When a file is renamed or moved **inside the app**, the syncer updates `rel_path` in the DB and all logical associations follow the entry. When a file is renamed or moved **outside the app** (shell, Finder, etc.), the scanner sees it as: old entry `missing=1` + new entry inserted with a fresh UUID — logical associations are lost.

**listEntries vs getEntry**: `GET /api/fs/roots/{rootId}/entries` reads the filesystem live (via `fsops.ListDir`) and then joins the `entries` table to populate IDs. This means:

- Files on disk that haven't been scanned yet appear in the file browser with no ID (cannot be renamed/deleted via API until scanned).
- Files that have been deleted externally still appear in `entries` with `missing=1`.

**ID population in listEntries**: after getting filesystem entries, the handler queries `SELECT id, rel_path FROM entries WHERE root_id=? AND parent_rel_path=?` and populates `entry.ID` for each match. This is a targeted query — only the entries in the current directory level.

---

## 8. Build & distribution

```makefile
# Makefile (approximate)
build:
    cd web && bun install && bun run build
    cp -r web/dist/* internal/httpapi/static/
    go build -o bin/files-dashboard ./cmd/app
```

- Frontend: Vite + `@vitejs/plugin-react` + `@tailwindcss/vite`. Output goes to `web/dist/`.
- The `internal/httpapi/static.go` file uses `//go:embed` to bundle the built frontend.
- Result: a single self-contained binary with no runtime dependencies.
- Data directory (`data/`) is gitignored and contains `config.json` + `app.db`.

Runtime configuration via env:
- `DATA_DIR` — override the data directory path (default: `data/`).

---

## 9. Security considerations

### Path traversal
`SafeJoin` provides strong protection for all in-app filesystem operations. The prefix check with trailing separators prevents both `../` escapes and prefix-collision attacks. The only gap: **symlinks** — if a symlink inside a root points outside, it is followed without detection. Mitigation: only add trusted directories as roots.

### LAN exposure (`lan_enabled` / `host: "0.0.0.0"`)
**There is no authentication**. Any device on the local network can reach all API endpoints, including file downloads (`/api/fs/entries/{id}/raw`) and file deletion. If `host` is set to `0.0.0.0`, treat this as exposing all configured roots to anyone on the network.

Mitigation options (not implemented):
- Reverse proxy (nginx/Caddy) with basic auth in front of the app.
- Bind to a VPN interface only.
- Do not expose on LAN if roots contain sensitive files.

### CORS
`DevCORS` middleware sets `Access-Control-Allow-Origin: *`. This means any website a user visits can make cross-origin requests to the local server if it knows the port. Relevant only if `host` is `127.0.0.1` (default) — browsers still block cross-origin requests from HTTPS pages to HTTP localhost in many configurations.

### Upload path
`SaveUpload` sanitizes the filename with `filepath.Base` (strips any directory component). The destination directory is validated with `SafeJoin`. Content-type is not enforced — any file type can be uploaded.

### No rate limiting
No rate limiting or request size limits beyond the 100 MB multipart cap on `POST /api/fs/upload`.

---

## 10. Known limitations / non-goals

| Area | Current state |
|---|---|
| Authentication | None. Single-user, trusted local/LAN only. |
| Filesystem watcher | None. Changes made outside the app require a manual rescan. |
| Concurrent scan safety | Two simultaneous `POST /api/scan` calls can race. No mutex guard. |
| Symlink traversal | SafeJoin validates lexical paths only; symlinks pointing outside root are followed. |
| Missing entry cleanup | Entries with `missing=1` are never automatically deleted; they accumulate. |
| Subtree move metadata | Moving a file outside the app breaks its logical associations (categories/tags). |
| FTS snippet/highlight | Contentless FTS5 table — `HIGHLIGHT()` and `SNIPPET()` are unavailable. |
| Pagination UI | Backend supports offset pagination; most frontend pages load all results. |
| Multi-user | One SQLite DB, no user model, no row-level permissions. |
| Mobile | UI is responsive but not optimized for touch. |
