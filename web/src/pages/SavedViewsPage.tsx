// web/src/pages/SavedViewsPage.tsx
import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { SavedView } from '@/lib/api'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Trash2,
  Pencil,
  ExternalLink,
  Search,
  Bookmark,
  Calendar,
} from 'lucide-react'

/** Pretty-print a filter key for display. */
function formatFilterKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

/** Parse the JSON-encoded filters string into key/value pairs. */
function parseFilters(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw || '{}')
    // If it's a flat object, return as-is
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed
    }
    return {}
  } catch {
    return {}
  }
}

/** Build a query-string from a filters object. */
function filtersToQueryString(filters: Record<string, string>): string {
  return new URLSearchParams(filters).toString()
}

/** Format a unix timestamp into a readable date. */
function formatDate(ts: number): string {
  const d = new Date(ts * 1000)
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function SavedViewsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: views = [], isLoading } = useQuery({
    queryKey: ['saved-views'],
    queryFn: api.savedViews.list,
  })

  // ── Rename state ──────────────────────────────────────────────────────
  const [renameTarget, setRenameTarget] = useState<SavedView | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renameTarget) {
      setRenameValue(renameTarget.name)
      // Focus the input after the dialog opens
      setTimeout(() => renameInputRef.current?.select(), 50)
    }
  }, [renameTarget])

  // ── Delete confirmation state ─────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<SavedView | null>(null)

  // ── Mutations ─────────────────────────────────────────────────────────
  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.savedViews.update(id, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-views'] })
      setRenameTarget(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.savedViews.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-views'] })
      setDeleteTarget(null)
    },
  })

  // ── Handlers ──────────────────────────────────────────────────────────
  function handleCardClick(view: SavedView) {
    const qs = filtersToQueryString(parseFilters(view.filters))
    navigate(`/search?${qs}`)
  }

  function handleEditFilters(e: React.MouseEvent, view: SavedView) {
    e.stopPropagation()
    const qs = filtersToQueryString(parseFilters(view.filters))
    navigate(`/search?${qs}`)
  }

  function handleRenameSubmit() {
    const trimmed = renameValue.trim()
    if (!renameTarget || !trimmed || trimmed === renameTarget.name) {
      setRenameTarget(null)
      return
    }
    renameMutation.mutate({ id: renameTarget.id, name: trimmed })
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget.id)
  }

  // ── Loading state ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Saved Views</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="h-36 rounded-lg border bg-card animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }

  // ── Empty state ───────────────────────────────────────────────────────
  if (views.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Saved Views</h1>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Bookmark className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium mb-1">No saved views yet</h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Save a search from the Search page to quickly access your
            frequently used filters.
          </p>
          <Button variant="outline" onClick={() => navigate('/search')}>
            <Search className="mr-2 h-4 w-4" />
            Go to Search
          </Button>
        </div>
      </div>
    )
  }

  // ── Main content ──────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Saved Views</h1>
        <p className="text-sm text-muted-foreground">
          {views.length} view{views.length !== 1 && 's'}
        </p>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {views.map(view => {
          const filters = parseFilters(view.filters)
          const filterEntries = Object.entries(filters).filter(
            ([, v]) => v != null && v !== ''
          )

          return (
            <Card
              key={view.id}
              className="group relative cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
              onClick={() => handleCardClick(view)}
            >
              <CardContent className="p-5">
                {/* Header row: name + date */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 mr-2">
                    <h3 className="font-medium text-base truncate">
                      {view.name}
                    </h3>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(view.created_at)}</span>
                    </div>
                  </div>

                  {/* Action buttons (visible on hover) */}
                  <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Rename"
                      onClick={e => {
                        e.stopPropagation()
                        setRenameTarget(view)
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Edit filters"
                      onClick={e => handleEditFilters(e, view)}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      title="Delete"
                      onClick={e => {
                        e.stopPropagation()
                        setDeleteTarget(view)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Filter badges */}
                <div className="flex flex-wrap gap-1.5">
                  {filterEntries.length > 0 ? (
                    filterEntries.map(([key, value]) => (
                      <Badge
                        key={key}
                        variant="secondary"
                        className="text-xs font-normal"
                      >
                        {formatFilterKey(key)}: {value}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground italic">
                      No filters
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* ── Rename dialog ──────────────────────────────────────────────── */}
      <Dialog
        open={renameTarget !== null}
        onOpenChange={open => {
          if (!open) setRenameTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename View</DialogTitle>
            <DialogDescription>
              Enter a new name for this saved view.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={e => {
              e.preventDefault()
              handleRenameSubmit()
            }}
          >
            <Input
              ref={renameInputRef}
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              placeholder="View name"
              className="mb-4"
              autoFocus
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  !renameValue.trim() ||
                  renameValue.trim() === renameTarget?.name ||
                  renameMutation.isPending
                }
              >
                {renameMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ─────────────────────────────────── */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={open => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete View</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
