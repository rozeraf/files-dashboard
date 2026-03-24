// web/src/pages/SearchPage.tsx
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Category } from '@/lib/api'
import { EntryGrid } from '@/components/ui/EntryGrid'
import { EntryTable } from '@/components/ui/EntryTable'
import { EntryDetailPanel } from '@/components/ui/EntryDetailPanel'
import { useState, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { LayoutGrid, List, Bookmark, Filter, X, ChevronDown } from 'lucide-react'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state'

const FILTER_KEYS = ['libraryId', 'categoryId', 'tags', 'ext', 'kind', 'since', 'size_min', 'size_max', 'status'] as const

function flattenCategories(cats: Category[]): Category[] {
  return cats.flatMap(c => [c, ...flattenCategories(c.children ?? [])])
}

function formatDateForInput(unixTimestamp: string | null): string {
  if (!unixTimestamp) return ''
  const ms = Number(unixTimestamp) * 1000
  if (Number.isNaN(ms)) return ''
  const d = new Date(ms)
  // Format as YYYY-MM-DD for date input
  return d.toISOString().split('T')[0]
}

function dateInputToUnix(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return String(Math.floor(d.getTime() / 1000))
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const qc = useQueryClient()
  const [view, setView] = useState<'grid' | 'table'>('grid')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saved, setSaved] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const params = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams])

  // Count active filters (excluding q, which is the main search)
  const activeFilterCount = useMemo(
    () => FILTER_KEYS.filter(k => params[k] && params[k] !== '').length,
    [params],
  )

  const setParam = useCallback((key: string, value: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) {
        next.set(key, value)
      } else {
        next.delete(key)
      }
      return next
    }, { replace: true })
    setSaved(false)
  }, [setSearchParams])

  const clearFilters = useCallback(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams()
      // Keep only q
      const q = prev.get('q')
      if (q) next.set('q', q)
      return next
    }, { replace: true })
    setSaved(false)
  }, [setSearchParams])

  // --- Data fetching for filter options ---
  const { data: libraries = [] } = useQuery({
    queryKey: ['libraries'],
    queryFn: api.libraries.list,
  })

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: api.tags.list,
  })

  const selectedLibraryId = params.libraryId || ''

  const { data: rawCategories = [] } = useQuery({
    queryKey: ['categories', selectedLibraryId],
    queryFn: () => api.libraries.categories(selectedLibraryId),
    enabled: !!selectedLibraryId,
  })

  const flatCategories = useMemo(
    () => flattenCategories(rawCategories),
    [rawCategories],
  )

  // Selected tag IDs as a Set
  const selectedTagIds = useMemo(() => {
    const raw = params.tags || ''
    if (!raw) return new Set<string>()
    return new Set(raw.split(',').filter(Boolean))
  }, [params.tags])

  const toggleTag = useCallback((tagId: string) => {
    const next = new Set(selectedTagIds)
    if (next.has(tagId)) {
      next.delete(tagId)
    } else {
      next.add(tagId)
    }
    setParam('tags', [...next].join(','))
  }, [selectedTagIds, setParam])

  // --- Search query ---
  const searchQuery = useQuery({
    queryKey: ['search', params],
    queryFn: () => api.search(params),
    enabled: Object.keys(params).length > 0,
  })
  const data = searchQuery.data ?? []

  const saveView = useMutation({
    mutationFn: () => api.savedViews.create(saveName, params),
    onSuccess: () => { setSaveOpen(false); setSaveName(''); setSaved(true) },
  })

  const hasAnyParams = Object.keys(params).length > 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Search {params.q && <span className="text-muted-foreground font-normal text-lg">"{params.q}"</span>}
        </h1>
        <div className="flex flex-wrap gap-2 items-center">
          {hasAnyParams && !saved && (
            <Button variant="outline" size="sm" onClick={() => { setSaveName(''); setSaveOpen(true) }} className="gap-1.5">
              <Bookmark size={14} />Save View
            </Button>
          )}
          {saved && <span className="text-xs text-muted-foreground self-center">Saved</span>}
          <div className="flex gap-1">
            <Button variant={view === 'grid' ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setView('grid')}><LayoutGrid size={15} /></Button>
            <Button variant={view === 'table' ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setView('table')}><List size={15} /></Button>
          </div>
        </div>
      </div>

      {/* Filter toggle button */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={filtersOpen ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFiltersOpen(o => !o)}
          className="gap-1.5"
        >
          <Filter size={14} />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-[11px] font-semibold rounded-full">
              {activeFilterCount}
            </Badge>
          )}
          <ChevronDown size={12} className={`transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
        </Button>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground gap-1">
            <X size={14} />
            Clear filters
          </Button>
        )}
      </div>

      {/* Collapsible filter panel */}
      {filtersOpen && (
        <div className="rounded-lg border bg-card p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">

            {/* Library */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">Library</label>
              <Select
                value={selectedLibraryId}
                onValueChange={v => {
                  setParam('libraryId', v === '__none__' ? '' : v)
                  // Clear category when library changes
                  if (v !== selectedLibraryId) setParam('categoryId', '')
                }}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All libraries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">All libraries</SelectItem>
                  {libraries.map(lib => (
                    <SelectItem key={lib.id} value={lib.id}>
                      {lib.icon} {lib.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category (depends on library) */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">Category</label>
              <Select
                value={params.categoryId || ''}
                onValueChange={v => setParam('categoryId', v === '__none__' ? '' : v)}
                disabled={!selectedLibraryId}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={selectedLibraryId ? 'All categories' : 'Select library first'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">All categories</SelectItem>
                  {flatCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.parent_id ? '\u00A0\u00A0' : ''}{cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Kind */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">Kind</label>
              <Select
                value={params.kind || ''}
                onValueChange={v => setParam('kind', v === '__none__' ? '' : v)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Any</SelectItem>
                  <SelectItem value="file">File</SelectItem>
                  <SelectItem value="dir">Directory</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Extension */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">Extension</label>
              <Input
                className="h-9 text-sm"
                placeholder="e.g. pdf, jpg, mp4"
                value={params.ext || ''}
                onChange={e => setParam('ext', e.target.value)}
              />
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">Status</label>
              <Select
                value={params.status || ''}
                onValueChange={v => setParam('status', v === '__none__' ? '' : v)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Any</SelectItem>
                  <SelectItem value="ok">OK</SelectItem>
                  <SelectItem value="missing">Missing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Since (date) */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">Modified since</label>
              <Input
                type="date"
                className="h-9 text-sm"
                value={formatDateForInput(params.since || null)}
                onChange={e => setParam('since', e.target.value ? dateInputToUnix(e.target.value) : '')}
              />
            </div>

            {/* Size min */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">Min size (bytes)</label>
              <Input
                type="number"
                className="h-9 text-sm"
                placeholder="0"
                min={0}
                value={params.size_min || ''}
                onChange={e => setParam('size_min', e.target.value)}
              />
            </div>

            {/* Size max */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">Max size (bytes)</label>
              <Input
                type="number"
                className="h-9 text-sm"
                placeholder="No limit"
                min={0}
                value={params.size_max || ''}
                onChange={e => setParam('size_max', e.target.value)}
              />
            </div>
          </div>

          {/* Tags (chip toggles) */}
          {allTags.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">Tags</label>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map(tag => {
                  const active = selectedTagIds.has(tag.id)
                  return (
                    <button key={tag.id} onClick={() => toggleTag(tag.id)} className="transition-opacity">
                      <Badge
                        style={active && tag.color ? { backgroundColor: tag.color, borderColor: tag.color } : undefined}
                        variant={active ? 'default' : 'outline'}
                        className="cursor-pointer text-sm px-2.5 py-0.5 select-none"
                      >
                        {tag.name}
                      </Badge>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {!hasAnyParams && (
        <EmptyState
          compact
          title="Start with a search or filter"
          description="Use the header search, then refine the result set with filters like library, tags, type, size, or date."
        />
      )}

      {hasAnyParams && searchQuery.isPending && (
        <LoadingState compact title="Searching" description="Applying filters and scanning the index." />
      )}

      {hasAnyParams && searchQuery.error && (
        <ErrorState
          compact
          title="Search failed"
          error={searchQuery.error}
          onRetry={() => void searchQuery.refetch()}
        />
      )}

      {hasAnyParams && !searchQuery.isPending && !searchQuery.error && data.length === 0 && (
        <EmptyState
          compact
          title="No results"
          description="Try widening the query, clearing filters, or changing the date and size constraints."
        />
      )}

      {hasAnyParams && !searchQuery.isPending && !searchQuery.error && data.length > 0 && (
        view === 'grid'
          ? <EntryGrid entries={data} onSelect={e => setDetailId(e.id)} />
          : <EntryTable entries={data} onSelect={e => setDetailId(e.id)} />
      )}

      <EntryDetailPanel entryId={detailId} onClose={() => setDetailId(null)}
        onDeleted={() => { setDetailId(null); qc.invalidateQueries({ queryKey: ['search'] }) }}
        onRenamed={() => qc.invalidateQueries({ queryKey: ['search'] })} />

      {/* Save view dialog */}
      <Dialog open={saveOpen} onOpenChange={o => !o && setSaveOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Save View</DialogTitle></DialogHeader>
          <Input placeholder="View name" value={saveName} onChange={e => setSaveName(e.target.value)} autoFocus
            onKeyDown={e => e.key === 'Enter' && saveName && saveView.mutate()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button onClick={() => saveView.mutate()} disabled={!saveName || saveView.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
