// web/src/pages/CollectionDetailPage.tsx
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Entry } from '@/lib/api'
import { EntryDetailPanel } from '@/components/ui/EntryDetailPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { useState, useRef, useCallback } from 'react'
import { X, GripVertical, Pencil, ChevronUp, ChevronDown } from 'lucide-react'
import { formatSize, formatDate, mimeToIcon, cn } from '@/lib/utils'

export function CollectionDetailPage() {
  const { collectionId } = useParams<{ collectionId: string }>()
  const qc = useQueryClient()

  // --- detail panel ---
  const [detailId, setDetailId] = useState<string | null>(null)

  // --- inline name editing ---
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  // --- edit dialog (description) ---
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [dialogName, setDialogName] = useState('')
  const [dialogDesc, setDialogDesc] = useState('')

  // --- drag state ---
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  // ── Queries ──────────────────────────────────────────────

  const { data: col } = useQuery({
    queryKey: ['collection', collectionId],
    queryFn: () => api.collections.get(collectionId!),
    enabled: !!collectionId,
  })

  const { data } = useQuery({
    queryKey: ['collection-entries', collectionId],
    queryFn: () => api.collections.entries(collectionId!),
    enabled: !!collectionId,
  })

  const entries: Entry[] = data?.items ?? []

  // ── Mutations ────────────────────────────────────────────

  const remove = useMutation({
    mutationFn: (entryId: string) => api.collections.remove(collectionId!, entryId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['collection-entries', collectionId] }),
  })

  const updateCollection = useMutation({
    mutationFn: (body: Partial<{ name: string; description: string }>) =>
      api.collections.update(collectionId!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collection', collectionId] })
      qc.invalidateQueries({ queryKey: ['collections'] })
    },
  })

  const reorderMut = useMutation({
    mutationFn: (order: string[]) =>
      api.collections.reorder(collectionId!, order),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['collection-entries', collectionId] }),
  })

  // ── Inline name edit helpers ─────────────────────────────

  function startEditName() {
    setDraftName(col?.name ?? '')
    setEditingName(true)
    requestAnimationFrame(() => nameInputRef.current?.select())
  }

  function commitName() {
    setEditingName(false)
    const trimmed = draftName.trim()
    if (trimmed && trimmed !== col?.name) {
      updateCollection.mutate({ name: trimmed })
    }
  }

  // ── Edit dialog helpers ──────────────────────────────────

  function openEditDialog() {
    setDialogName(col?.name ?? '')
    setDialogDesc(col?.description ?? '')
    setEditDialogOpen(true)
  }

  function commitDialog() {
    const patch: Partial<{ name: string; description: string }> = {}
    const trimName = dialogName.trim()
    const trimDesc = dialogDesc.trim()
    if (trimName && trimName !== col?.name) patch.name = trimName
    if (trimDesc !== (col?.description ?? '')) patch.description = trimDesc
    if (Object.keys(patch).length) updateCollection.mutate(patch)
    setEditDialogOpen(false)
  }

  // ── Drag-and-drop ────────────────────────────────────────

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLTableRowElement>, idx: number) => {
      setDragIndex(idx)
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', String(idx))
      // Make the dragged row slightly transparent
      requestAnimationFrame(() => {
        ;(e.target as HTMLElement).style.opacity = '0.4'
      })
    },
    [],
  )

  const handleDragEnd = useCallback(
    (e: React.DragEvent<HTMLTableRowElement>) => {
      ;(e.target as HTMLElement).style.opacity = '1'
      setDragIndex(null)
      setOverIndex(null)
    },
    [],
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLTableRowElement>, idx: number) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setOverIndex(idx)
    },
    [],
  )

  const reorderEntries = useCallback((from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= entries.length || to >= entries.length) return

    const reordered = [...entries]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)

    qc.setQueryData(
      ['collection-entries', collectionId],
      (old: any) => old ? { ...old, items: reordered } : old,
    )

    reorderMut.mutate(reordered.map((e) => e.id))
  }, [entries, collectionId, qc, reorderMut])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLTableRowElement>, dropIdx: number) => {
      e.preventDefault()
      const from = dragIndex
      if (from === null || from === dropIdx) {
        setDragIndex(null)
        setOverIndex(null)
        return
      }

      reorderEntries(from, dropIdx)
      setDragIndex(null)
      setOverIndex(null)
    },
    [dragIndex, reorderEntries],
  )

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          {/* Collection name: click to edit inline */}
          {editingName ? (
            <Input
              ref={nameInputRef}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName()
                if (e.key === 'Escape') setEditingName(false)
              }}
              className="text-2xl font-semibold h-auto py-1 px-2 -ml-2"
              autoFocus
            />
          ) : (
            <h1
              className="text-2xl font-semibold truncate cursor-text hover:text-primary/80 transition-colors"
              onClick={startEditName}
              title="Click to rename"
            >
              {col?.name ?? '\u00A0'}
            </h1>
          )}

          {col?.description && (
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              {col.description}
            </p>
          )}

          <p className="text-xs text-muted-foreground/60 mt-1">
            {entries.length} {entries.length === 1 ? 'item' : 'items'}
            {col?.created_at
              ? ` \u00B7 Created ${formatDate(col.created_at)}`
              : ''}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0 self-start"
          onClick={openEditDialog}
        >
          <Pencil size={14} />
          Edit
        </Button>
      </div>

      {/* Entries table */}
      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          This collection is empty. Add entries from the file browser.
        </div>
      ) : (
        <>
        <div className="space-y-2 sm:hidden">
          {entries.map((entry, idx) => (
            <div key={entry.id} className="rounded-xl border bg-card p-3">
              <button className="flex w-full items-start gap-3 text-left" onClick={() => setDetailId(entry.id)}>
                <span className="mt-0.5 shrink-0 text-base">
                  {mimeToIcon(entry.mime, entry.kind)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{entry.name}</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>#{idx + 1}</span>
                    <span className="tabular-nums">{formatSize(entry.size)}</span>
                    <span>{formatDate(entry.mtime)}</span>
                  </div>
                </div>
              </button>
              <div className="mt-3 flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={idx === 0 || reorderMut.isPending}
                  onClick={() => reorderEntries(idx, idx - 1)}
                >
                  <ChevronUp size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={idx === entries.length - 1 || reorderMut.isPending}
                  onClick={() => reorderEntries(idx, idx + 1)}
                >
                  <ChevronDown size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  title="Remove from collection"
                  onClick={() => remove.mutate(entry.id)}
                >
                  <X size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden rounded-lg border overflow-hidden sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="w-10 px-2 py-2.5"></th>
                <th className="py-2.5 font-medium">Name</th>
                <th className="py-2.5 font-medium hidden sm:table-cell">Size</th>
                <th className="py-2.5 font-medium hidden md:table-cell">Modified</th>
                <th className="w-10 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => {
                const isDragging = dragIndex === idx
                const isOver = overIndex === idx && dragIndex !== null && dragIndex !== idx
                const insertAbove = isOver && dragIndex !== null && idx < dragIndex
                const insertBelow = isOver && dragIndex !== null && idx > dragIndex

                return (
                  <tr
                    key={entry.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    className={cn(
                      'border-b last:border-b-0 transition-colors group',
                      isDragging && 'opacity-40',
                      !isDragging && 'hover:bg-muted/50',
                      insertAbove && 'border-t-2 border-t-primary',
                      insertBelow && 'border-b-2 border-b-primary',
                    )}
                  >
                    {/* Grip handle */}
                    <td className="px-2 py-2 text-muted-foreground/40 cursor-grab active:cursor-grabbing">
                      <GripVertical size={16} />
                    </td>

                    {/* Name cell */}
                    <td
                      className="py-2 pr-4 cursor-pointer"
                      onClick={() => setDetailId(entry.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0 text-base">
                          {mimeToIcon(entry.mime, entry.kind)}
                        </span>
                        <span className="truncate font-medium">
                          {entry.name}
                        </span>
                      </div>
                    </td>

                    {/* Size */}
                    <td className="py-2 text-muted-foreground tabular-nums hidden sm:table-cell">
                      {formatSize(entry.size)}
                    </td>

                    {/* Modified */}
                    <td className="py-2 text-muted-foreground hidden md:table-cell">
                      {formatDate(entry.mtime)}
                    </td>

                    {/* Remove button */}
                    <td className="py-2 pr-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        title="Remove from collection"
                        onClick={(e) => {
                          e.stopPropagation()
                          remove.mutate(entry.id)
                        }}
                      >
                        <X size={14} />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* Edit dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={dialogName}
                onChange={(e) => setDialogName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitDialog()
                }}
                placeholder="Collection name"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={dialogDesc}
                onChange={(e) => setDialogDesc(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitDialog()
                }}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={commitDialog} disabled={!dialogName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entry detail panel */}
      <EntryDetailPanel
        entryId={detailId}
        onClose={() => setDetailId(null)}
        onDeleted={() => {
          setDetailId(null)
          qc.invalidateQueries({ queryKey: ['collection-entries', collectionId] })
        }}
        onRenamed={() =>
          qc.invalidateQueries({ queryKey: ['collection-entries', collectionId] })
        }
      />
    </div>
  )
}
