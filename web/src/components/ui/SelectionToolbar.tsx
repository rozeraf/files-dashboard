// web/src/components/ui/SelectionToolbar.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUI } from '@/stores/ui'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Trash2, X, FolderInput, Tag, Library } from 'lucide-react'

export function SelectionToolbar() {
  const { selectedIds, clearSelection } = useUI()
  const qc = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [tagOpen, setTagOpen] = useState(false)
  const [catOpen, setCatOpen] = useState(false)
  const [moveRootId, setMoveRootId] = useState('')
  const [movePath, setMovePath] = useState('')
  const [pendingTagIds, setPendingTagIds] = useState<Set<string>>(new Set())
  const [pendingCatIds, setPendingCatIds] = useState<Set<string>>(new Set())

  const count = selectedIds.size
  const ids = [...selectedIds]

  const { data: roots = [] } = useQuery({ queryKey: ['roots'], queryFn: api.roots.list, enabled: moveOpen })
  const { data: allTags = [] } = useQuery({ queryKey: ['tags'], queryFn: api.tags.list, enabled: tagOpen })
  const { data: libraries = [] } = useQuery({ queryKey: ['libraries'], queryFn: api.libraries.list, enabled: catOpen })
  const libCatQueries = useQuery({
    queryKey: ['all-categories-flat'],
    queryFn: async () => {
      const libs = await api.libraries.list()
      const results = await Promise.all(libs.map(async lib => ({
        lib,
        cats: flattenCats(await api.libraries.categories(lib.id)),
      })))
      return results
    },
    enabled: catOpen,
  })
  const libCategories = libCatQueries.data ?? []

  const invalidateAll = () => { qc.invalidateQueries(); clearSelection() }

  const del = useMutation({
    mutationFn: () => api.fs.delete(ids),
    onSuccess: () => { invalidateAll(); setConfirmOpen(false) },
  })

  const move = useMutation({
    mutationFn: () => api.fs.move(ids, moveRootId, movePath),
    onSuccess: () => { invalidateAll(); setMoveOpen(false) },
  })

  const assignTags = useMutation({
    mutationFn: async () => {
      await Promise.allSettled(ids.map(id =>
        api.entries.assignTags(id, [...pendingTagIds], [])
      ))
    },
    onSuccess: () => { invalidateAll(); setTagOpen(false) },
  })

  const assignCats = useMutation({
    mutationFn: async () => {
      await Promise.allSettled(ids.map(id =>
        api.entries.assignCategories(id, [...pendingCatIds], [])
      ))
    },
    onSuccess: () => { invalidateAll(); setCatOpen(false) },
  })

  const openMove = () => { setMoveRootId(roots[0]?.id ?? ''); setMovePath(''); setMoveOpen(true) }
  const openTags = () => { setPendingTagIds(new Set()); setTagOpen(true) }
  const openCats = () => { setPendingCatIds(new Set()); setCatOpen(true) }

  const toggleTag = (id: string) => setPendingTagIds(p => {
    const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n
  })
  const toggleCat = (id: string) => setPendingCatIds(p => {
    const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  return (
    <>
      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-card border shadow-2xl transition-all duration-300 ${
          count > 0 ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0 pointer-events-none'
        }`}
      >
        <span className="text-sm font-semibold tabular-nums pr-1">{count} selected</span>
        <div className="w-px h-5 bg-border" />

        <Button variant="ghost" size="sm" className="gap-1.5 h-8 text-xs" onClick={openMove}>
          <FolderInput size={13} />Move
        </Button>
        <Button variant="ghost" size="sm" className="gap-1.5 h-8 text-xs" onClick={openTags}>
          <Tag size={13} />Tag
        </Button>
        <Button variant="ghost" size="sm" className="gap-1.5 h-8 text-xs" onClick={openCats}>
          <Library size={13} />Categorize
        </Button>

        <div className="w-px h-5 bg-border" />
        <Button
          variant="ghost" size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 h-8 text-xs"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 size={13} />Delete
        </Button>
        <div className="w-px h-5 bg-border" />
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={clearSelection}>
          <X size={13} />
        </Button>
      </div>

      {/* Delete confirm */}
      <Dialog open={confirmOpen} onOpenChange={o => !o && setConfirmOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {count} {count === 1 ? 'file' : 'files'}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete {count === 1 ? 'the file' : `all ${count} files`} from disk. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => del.mutate()} disabled={del.isPending}>
              {del.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move dialog */}
      <Dialog open={moveOpen} onOpenChange={o => !o && setMoveOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Move {count} {count === 1 ? 'file' : 'files'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Destination root</p>
              <Select value={moveRootId} onValueChange={setMoveRootId}>
                <SelectTrigger><SelectValue placeholder="Select root..." /></SelectTrigger>
                <SelectContent>
                  {roots.map(r => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Destination path</p>
              <Input placeholder="e.g. photos/2026" value={movePath} onChange={e => setMovePath(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>Cancel</Button>
            <Button onClick={() => move.mutate()} disabled={!moveRootId || move.isPending}>
              {move.isPending ? 'Moving...' : 'Move'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag dialog */}
      <Dialog open={tagOpen} onOpenChange={o => !o && setTagOpen(false)}>
        <DialogContent className="max-h-[70vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add tags to {count} {count === 1 ? 'file' : 'files'}</DialogTitle></DialogHeader>
          <div className="flex flex-wrap gap-2">
            {allTags.map(tag => (
              <button key={tag.id} onClick={() => toggleTag(tag.id)}>
                <Badge
                  style={{ backgroundColor: tag.color || undefined }}
                  variant={pendingTagIds.has(tag.id) ? 'default' : 'outline'}
                  className="cursor-pointer text-sm px-3 py-1 transition-all"
                >
                  {tag.name}
                </Badge>
              </button>
            ))}
            {allTags.length === 0 && <p className="text-sm text-muted-foreground">No tags yet.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagOpen(false)}>Cancel</Button>
            <Button onClick={() => assignTags.mutate()} disabled={pendingTagIds.size === 0 || assignTags.isPending}>
              {assignTags.isPending ? 'Saving...' : `Add ${pendingTagIds.size} tag${pendingTagIds.size !== 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Categorize dialog */}
      <Dialog open={catOpen} onOpenChange={o => !o && setCatOpen(false)}>
        <DialogContent className="max-h-[70vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Categorize {count} {count === 1 ? 'file' : 'files'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {libCategories.map(({ lib, cats }) => cats.length === 0 ? null : (
              <div key={lib.id}>
                <p className="text-sm font-medium mb-2">{lib.icon} {lib.name}</p>
                <div className="space-y-1 pl-2">
                  {cats.map(cat => (
                    <label key={cat.id} className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox
                        checked={pendingCatIds.has(cat.id)}
                        onCheckedChange={() => toggleCat(cat.id)}
                      />
                      {cat.name}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {libCategories.length === 0 && <p className="text-sm text-muted-foreground">No categories yet.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatOpen(false)}>Cancel</Button>
            <Button onClick={() => assignCats.mutate()} disabled={pendingCatIds.size === 0 || assignCats.isPending}>
              {assignCats.isPending ? 'Saving...' : `Assign ${pendingCatIds.size} categor${pendingCatIds.size !== 1 ? 'ies' : 'y'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function flattenCats(cats: import('@/lib/api').Category[]): import('@/lib/api').Category[] {
  return cats.flatMap(c => [c, ...flattenCats(c.children ?? [])])
}
