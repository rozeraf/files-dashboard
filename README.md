# files-dashboard

Локальный self-hosted дашборд для управления файлами. Единый Go-бинарник со встроенным React SPA, SQLite FTS5 индексом и двухслойной организацией файлов.

## Что это

Приложение индексирует указанные папки (roots) на диске и предоставляет удобный веб-интерфейс поверх них — без перемещения файлов. Физическая структура остаётся нетронутой; поверх неё строится логическая организация: библиотеки, категории, теги, коллекции.

**Ключевые свойства:**
- Один бинарник — backend + frontend внутри, никаких зависимостей при запуске
- Filesystem is the source of truth — SQLite только индекс, файлы не трогает
- Полнотекстовый поиск по именам, путям, тегам и категориям (SQLite FTS5)
- Виртуальная организация: категории и теги не создают папок на диске
- Тёмная / светлая тема, grid / table вид, панель детали с превью

## Стек

| Слой | Технология |
|---|---|
| Backend | Go 1.22+, `chi`, `modernc.org/sqlite` (CGO-free, FTS5) |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v4, shadcn/ui |
| State | TanStack Query v5, Zustand |
| Routing | React Router v6 |
| Build | `bun` (frontend), `make` (полный пайплайн) |

## Быстрый старт

```bash
# Собрать всё (frontend → embed → Go binary)
make build

# Запустить
./bin/files-dashboard
# → http://localhost:4537
```

По умолчанию данные хранятся в `./data/` (SQLite + config.json). Переопределить:

```bash
DATA_DIR=/var/lib/files-dashboard ./bin/files-dashboard
```

## Разработка

```bash
# Терминал 1 — Go backend (горячая перезагрузка через air или вручную)
make dev-backend

# Терминал 2 — Vite dev server с прокси /api → :4537
make dev-frontend
# → http://localhost:5173
```

## Make-цели

| Цель | Что делает |
|---|---|
| `make build` | `bun build` → копирует в embed-папку → `go build` |
| `make run` | build + запуск бинарника |
| `make test` | `go test ./... -v` |
| `make test-race` | тесты с детектором гонок |
| `make dev-backend` | `go run ./cmd/app` |
| `make dev-frontend` | `cd web && bun run dev` |
| `make clean` | удаляет bin/, web/dist, embedded static |

## Структура проекта

```
cmd/app/            — точка входа (main.go)
internal/
  config/           — конфиг (JSON, атомарная запись)
  model/            — доменные типы и API DTOs
  index/            — SQLite schema, scanner, FTS5 sync, search
  fsops/            — безопасные FS-операции (path traversal check)
  organize/         — библиотеки, категории, теги, коллекции, избранное
  httpapi/          — Chi router, все HTTP-хендлеры, SPA-serving
web/
  src/
    lib/            — api.ts (типизированный клиент), utils.ts
    stores/         — Zustand UI store (тема, выделение)
    components/     — Shell, Sidebar, Header, EntryGrid, EntryTable, EntryDetailPanel
    pages/          — все страницы (Home, Library, Search, Settings и т.д.)
```

## Конфигурация

При первом запуске создаётся локальный `data/config.json`:

```json
{
  "host": "127.0.0.1",
  "port": 4537,
  "app_name": "Files Dashboard",
  "lan_enabled": false,
  "roots": []
}
```

В репозитории хранится только шаблон: `data/config.json.example`. Рабочий `data/config.json` не версионируется.

Roots (папки для индексирования) добавляются через Settings → Storage Roots или напрямую через API:

```bash
curl -X POST http://localhost:4537/api/fs/roots \
  -H 'Content-Type: application/json' \
  -d '{"path": "/home/user/Documents", "label": "Documents"}'
```

После добавления root запустите индексацию: Settings → Full Rescan или `POST /api/scan`.

## API

Все эндпоинты под `/api/`:

| Группа | Примеры |
|---|---|
| Roots & FS | `GET /api/fs/roots`, `GET /api/fs/roots/:id/entries`, `GET /api/fs/entries/:id/raw` |
| Libraries | `GET /api/libraries`, `GET /api/libraries/:id/categories` |
| Categories | `POST /api/categories`, `GET /api/categories/:id/entries` |
| Tags | `GET /api/tags`, `POST /api/entries/:id/tags` |
| Collections | `GET /api/collections`, `POST /api/collections/:id/entries` |
| Discovery | `GET /api/recent`, `GET /api/favorites`, `GET /api/uncategorized` |
| Search | `GET /api/search?q=...&ext=pdf&tags=id1,id2` |
| Scan | `POST /api/scan`, `GET /api/scan/:jobId` |

## Тесты

```bash
make test
make test-e2e
```

`make test-e2e` запускает Playwright smoke/e2e-набор против изолированного временного `DATA_DIR`, поднимает Go-приложение, создает фикстурный root с файлами и проверяет ключевые пользовательские сценарии в desktop и mobile viewport.

Покрыты: config, fsops, index (scan + FTS5 sync), model (slugify), organize (CRUD для всех сущностей), а также Playwright smoke/e2e для поиска, файлового браузера, мобильной навигации и страниц со списками.
