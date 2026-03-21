// web/src/lib/api.ts

const BASE = '/api'

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

const get = <T>(path: string) => req<T>('GET', path)
const post = <T>(path: string, body?: unknown) => req<T>('POST', path, body)
const patch = <T>(path: string, body?: unknown) => req<T>('PATCH', path, body)
const del = <T>(path: string, body?: unknown) => req<T>('DELETE', path, body)

// --- Types ---
export interface Root { id: string; path: string; label: string; created_at: number }
export interface Entry {
  id: string; root_id: string; rel_path: string; parent_rel_path: string
  name: string; kind: 'file' | 'dir'; size: number | null; mtime: number
  ext: string; mime: string; missing: boolean; updated_at: number
}
export interface EntryDetail extends Entry {
  categories: Category[]; tags: Tag[]; collections: CollectionRef[]; favorited: boolean
}
export interface Library { id: string; name: string; slug: string; icon: string; position: number }
export interface Category {
  id: string; library_id: string; parent_id: string | null
  name: string; slug: string; position: number; children?: Category[]
}
export interface Tag { id: string; name: string; color: string }
export interface Collection { id: string; name: string; description: string; created_at: number }
export interface CollectionRef { id: string; name: string }
export interface SavedView { id: string; name: string; filters: string; created_at: number }
export interface PagedResponse<T> { items: T[]; total: number; page: number; limit: number }
export interface ScanJob { jobId: string; status: 'running' | 'done' | 'error'; scanned: number; added: number; removed: number }
export interface Config { host: string; port: number; app_name: string; roots: Root[]; lan_enabled: boolean }

export const api = {
  roots: {
    list: () => get<Root[]>('/fs/roots'),
    create: (body: { path: string; label: string }) => post<Root>('/fs/roots', body),
    update: (id: string, label: string) => patch<void>(`/fs/roots/${id}`, { label }),
    delete: (id: string) => del<void>(`/fs/roots/${id}`),
  },
  fs: {
    list: (rootId: string, path = '') => get<Entry[]>(`/fs/roots/${rootId}/entries?path=${encodeURIComponent(path)}`),
    raw: (id: string) => `/api/fs/entries/${id}/raw`,
    rename: (id: string, name: string) => post<void>(`/fs/entries/${id}/rename`, { name }),
    move: (ids: string[], destRootId: string, destRelPath: string) =>
      post<void>('/fs/entries/move', { ids, destRootId, destRelPath }),
    delete: (ids: string[]) => del<void>('/fs/entries', { ids }),
    mkdir: (rootId: string, relPath: string, name: string) =>
      post<void>('/fs/directories', { rootId, relPath, name }),
    upload: (rootId: string, relPath: string, file: File): Promise<Entry> => {
      const fd = new FormData()
      fd.append('rootId', rootId)
      fd.append('relPath', relPath)
      fd.append('file', file)
      return fetch('/api/fs/upload', { method: 'POST', body: fd }).then(async r => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({ error: r.statusText }))
          throw new Error(err.error || r.statusText)
        }
        return r.json()
      })
    },
  },
  libraries: {
    list: () => get<Library[]>('/libraries'),
    get: (id: string) => get<Library>(`/libraries/${id}`),
    create: (name: string, icon: string) => post<Library>('/libraries', { name, icon }),
    update: (id: string, body: Partial<{ name: string; icon: string; position: number }>) =>
      patch<void>(`/libraries/${id}`, body),
    delete: (id: string) => del<void>(`/libraries/${id}`),
    categories: (id: string) => get<Category[]>(`/libraries/${id}/categories`),
  },
  categories: {
    get: (id: string) => get<Category>(`/categories/${id}`),
    create: (libraryId: string, parentId: string | null, name: string) =>
      post<Category>('/categories', { libraryId, parentId, name }),
    update: (id: string, body: Partial<{ name: string; parentId: string; position: number }>) =>
      patch<void>(`/categories/${id}`, body),
    delete: (id: string) => del<void>(`/categories/${id}`),
    entries: (id: string, page = 1, limit = 50) =>
      get<PagedResponse<Entry>>(`/categories/${id}/entries?page=${page}&limit=${limit}`),
    subcategories: (id: string) => get<Category[]>(`/categories/${id}/subcategories`),
  },
  entries: {
    get: (id: string) => get<EntryDetail>(`/entries/${id}`),
    assignCategories: (id: string, add: string[], remove: string[]) =>
      post<void>(`/entries/${id}/categories`, { add, remove }),
    assignTags: (id: string, add: string[], remove: string[]) =>
      post<void>(`/entries/${id}/tags`, { add, remove }),
  },
  tags: {
    list: () => get<Tag[]>('/tags'),
    get: (id: string) => get<Tag>(`/tags/${id}`),
    create: (name: string, color: string) => post<Tag>('/tags', { name, color }),
    update: (id: string, body: Partial<{ name: string; color: string }>) => patch<void>(`/tags/${id}`, body),
    delete: (id: string) => del<void>(`/tags/${id}`),
  },
  collections: {
    list: () => get<Collection[]>('/collections'),
    get: (id: string) => get<Collection>(`/collections/${id}`),
    create: (name: string, description = '') => post<Collection>('/collections', { name, description }),
    update: (id: string, body: Partial<{ name: string; description: string }>) =>
      patch<void>(`/collections/${id}`, body),
    delete: (id: string) => del<void>(`/collections/${id}`),
    entries: (id: string, page = 1, limit = 50) =>
      get<PagedResponse<Entry>>(`/collections/${id}/entries?page=${page}&limit=${limit}`),
    add: (id: string, entryId: string) => post<void>(`/collections/${id}/entries`, { entryId }),
    remove: (id: string, entryId: string) => del<void>(`/collections/${id}/entries/${entryId}`),
    reorder: (id: string, order: string[]) => post<void>(`/collections/${id}/entries/reorder`, { order }),
  },
  favorites: {
    list: (limit = 50) => get<Entry[]>(`/favorites?limit=${limit}`),
    add: (entryId: string) => post<void>(`/favorites/${entryId}`),
    remove: (entryId: string) => del<void>(`/favorites/${entryId}`),
  },
  recent: (limit = 50) => get<Entry[]>(`/recent?limit=${limit}`),
  uncategorized: (page = 1, limit = 50) =>
    get<PagedResponse<Entry>>(`/uncategorized?page=${page}&limit=${limit}`),
  savedViews: {
    list: () => get<SavedView[]>('/saved-views'),
    get: (id: string) => get<SavedView>(`/saved-views/${id}`),
    create: (name: string, filters: object) => post<SavedView>('/saved-views', { name, filters }),
    update: (id: string, body: Partial<{ name: string; filters: object }>) =>
      patch<void>(`/saved-views/${id}`, body),
    delete: (id: string) => del<void>(`/saved-views/${id}`),
  },
  search: (params: Record<string, string | number>) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => [k, String(v)])
    )
    return get<Entry[]>(`/search?${qs}`)
  },
  config: {
    get: () => get<Config>('/config'),
    update: (body: Partial<{ app_name: string; host: string; port: number }>) =>
      patch<{ restart_required: boolean }>('/config', body),
  },
  scan: {
    start: () => post<ScanJob>('/scan'),
    status: (jobId: string) => get<ScanJob>(`/scan/${jobId}`),
  },
}
