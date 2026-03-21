// web/src/components/ui/EntryDetailPanel.tsx
import { useState } from 'react'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatSize, formatDate, mimeToIcon } from '@/lib/utils'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Heart, HeartOff, Pencil, Trash2, Tag, FolderOpen, Library } from 'lucide-react'

interface Props {
  entryId: string | null
  onClose: () => void
  onDeleted?: () => void
  onRenamed?: () => void
}

export function EntryDetailPanel({ entryId, onClose, onDeleted, onRenamed }: Props) {
  const qc = useQueryClient()
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameName, setRenameName] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [catsOpen, setCatsOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [colOpen, setColOpen] = useState(false)
  const [colId, setColId] = useState('')

  const { data } = useQuery({
    queryKey: ['entry', entryId],
    queryFn: () => api.entries.get(entryId!),
    enabled: !!entryId,
  })

  // For category assignment dialog
  const { data: libraries = [] } = useQuery({
    queryKey: ['libraries'],
    queryFn: api.libraries.list,
    enabled: catsOpen,
  })
  const libCategoryResults = useQueries({
    queries: libraries.map(lib => ({
      queryKey: ['categories', lib.id],
      queryFn: () => api.libraries.categories(lib.id),
      enabled: catsOpen,
    })),
  })
  const libCategories = libraries.map((lib, i) => ({
    lib,
    cats: (libCategoryResults[i]?.data ?? []).flatMap(c => [c, ...(c.children ?? [])]),
  }))

  // For tag assignment dialog
  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: api.tags.list,
    enabled: tagsOpen,
  })

  // For collection assignment dialog
  const { data: allCollections = [] } = useQuery({
    queryKey: ['collections'],
    queryFn: api.collections.list,
    enabled: colOpen,
  })

  const [pendingCatIds, setPendingCatIds] = useState<Set<string>>(new Set())
  const [pendingTagIds, setPendingTagIds] = useState<Set<string>>(new Set())

  const openCats = () => {
    if (!data) return
    setPendingCatIds(new Set(data.categories.map(c => c.id)))
    setCatsOpen(true)
  }
  const openTags = () => {
    if (!data) return
    setPendingTagIds(new Set(data.tags.map(t => t.id)))
    setTagsOpen(true)
  }

  const toggleCat = (id: string) => setPendingCatIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const toggleTag = (id: string) => setPendingTagIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const invalidateEntry = () => qc.invalidateQueries({ queryKey: ['entry', entryId] })

  const toggleFav = useMutation({
    mutationFn: () => data?.favorited
      ? api.favorites.remove(entryId!)
      : api.favorites.add(entryId!),
    onSuccess: () => {
      invalidateEntry()
      qc.invalidateQueries({ queryKey: ['favorites'] })
    },
  })

  const rename = useMutation({
    mutationFn: () => api.fs.rename(entryId!, renameName),
    onSuccess: () => {
      invalidateEntry()
      setRenameOpen(false)
      onRenamed?.()
    },
  })

  const deleteMut = useMutation({
    mutationFn: () => api.fs.delete([entryId!]),
    onSuccess: () => {
      setDeleteOpen(false)
      onDeleted ? onDeleted() : onClose()
    },
  })

  const assignCats = useMutation({
    mutationFn: () => {
      const current = new Set(data!.categories.map(c => c.id))
      const add = [...pendingCatIds].filter(id => !current.has(id))
      const remove = [...current].filter(id => !pendingCatIds.has(id))
      return api.entries.assignCategories(entryId!, add, remove)
    },
    onSuccess: () => { invalidateEntry(); setCatsOpen(false) },
  })

  const assignTags = useMutation({
    mutationFn: () => {
      const current = new Set(data!.tags.map(t => t.id))
      const add = [...pendingTagIds].filter(id => !current.has(id))
      const remove = [...current].filter(id => !pendingTagIds.has(id))
      return api.entries.assignTags(entryId!, add, remove)
    },
    onSuccess: () => { invalidateEntry(); setTagsOpen(false) },
  })

  const addToCol = useMutation({
    mutationFn: () => api.collections.add(colId, entryId!),
    onSuccess: () => {
      invalidateEntry()
      qc.invalidateQueries({ queryKey: ['collection-entries', colId] })
      setColOpen(false)
      setColId('')
    },
  })

  const openRename = () => { setRenameName(data?.name ?? ''); setRenameOpen(true) }

  if (!data) return null

  const isImage = data.mime.startsWith('image/')
  const isVideo = data.mime.startsWith('video/')
  const isAudio = data.mime.startsWith('audio/')
  const isPDF = data.mime.includes('pdf')

  return (
    <>
      <Sheet open={!!entryId} onOpenChange={o => !o && onClose()}>
        <SheetContent className="w-96 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="truncate">{data.name}</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {/* Preview */}
            <div className="rounded-lg overflow-hidden bg-muted aspect-video flex items-center justify-center">
              {isImage && <img src={api.fs.raw(data.id)} className="w-full h-full object-contain" alt={data.name} />}
              {isVideo && <video src={api.fs.raw(data.id)} controls className="w-full" />}
              {isAudio && <audio src={api.fs.raw(data.id)} controls className="w-full" />}
              {isPDF && <iframe src={api.fs.raw(data.id)} className="w-full h-full" title={data.name} />}
              {!isImage && !isVideo && !isAudio && !isPDF && (
                <span className="text-5xl">{mimeToIcon(data.mime, data.kind)}</span>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => toggleFav.mutate()}>
                {data.favorited ? <HeartOff size={14} className="mr-1" /> : <Heart size={14} className="mr-1" />}
                {data.favorited ? 'Unfavorite' : 'Favorite'}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={api.fs.raw(data.id)} download={data.name}>Download</a>
              </Button>
              <Button variant="outline" size="sm" onClick={openRename}>
                <Pencil size={14} className="mr-1" />Rename
              </Button>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 size={14} className="mr-1" />Delete
              </Button>
            </div>

            {/* Metadata */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Size</span><span>{formatSize(data.size)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Modified</span><span>{formatDate(data.mtime)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{data.mime || data.ext}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Path</span><span className="text-xs truncate max-w-[200px]">{data.rel_path}</span></div>
            </div>

            {/* Categories */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Categories</p>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={openCats}>
                  <Library size={11} />
                </Button>
              </div>
              {data.categories.length > 0
                ? <div className="flex flex-wrap gap-1">{data.categories.map(c => <Badge key={c.id} variant="secondary">{c.name}</Badge>)}</div>
                : <p className="text-xs text-muted-foreground">None</p>
              }
            </div>

            {/* Tags */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Tags</p>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={openTags}>
                  <Tag size={11} />
                </Button>
              </div>
              {data.tags.length > 0
                ? <div className="flex flex-wrap gap-1">{data.tags.map(t => (
                    <Badge key={t.id} style={{ backgroundColor: t.color || undefined }} variant="outline">{t.name}</Badge>
                  ))}</div>
                : <p className="text-xs text-muted-foreground">None</p>
              }
            </div>

            {/* Collections */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Collections</p>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setColOpen(true)}>
                  <FolderOpen size={11} />
                </Button>
              </div>
              {data.collections.length > 0
                ? <div className="flex flex-wrap gap-1">{data.collections.map(c => <Badge key={c.id} variant="secondary">{c.name}</Badge>)}</div>
                : <p className="text-xs text-muted-foreground">None</p>
              }
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={o => !o && setRenameOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename</DialogTitle></DialogHeader>
          <Input value={renameName} onChange={e => setRenameName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && renameName && rename.mutate()} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={() => rename.mutate()} disabled={!renameName || rename.isPending}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={o => !o && setDeleteOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete "{data.name}"?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete the file from disk. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category assignment dialog */}
      <Dialog open={catsOpen} onOpenChange={o => !o && setCatsOpen(false)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Assign Categories</DialogTitle></DialogHeader>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatsOpen(false)}>Cancel</Button>
            <Button onClick={() => assignCats.mutate()} disabled={assignCats.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag assignment dialog */}
      <Dialog open={tagsOpen} onOpenChange={o => !o && setTagsOpen(false)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Assign Tags</DialogTitle></DialogHeader>
          <div className="flex flex-wrap gap-2">
            {allTags.map(tag => (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className="transition-opacity"
              >
                <Badge
                  style={{ backgroundColor: tag.color || undefined }}
                  variant={pendingTagIds.has(tag.id) ? 'default' : 'outline'}
                  className="cursor-pointer text-sm px-3 py-1"
                >
                  {tag.name}
                </Badge>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagsOpen(false)}>Cancel</Button>
            <Button onClick={() => assignTags.mutate()} disabled={assignTags.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to collection dialog */}
      <Dialog open={colOpen} onOpenChange={o => !o && setColOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add to Collection</DialogTitle></DialogHeader>
          <Select value={colId} onValueChange={setColId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a collection…" />
            </SelectTrigger>
            <SelectContent>
              {allCollections.map(col => (
                <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setColOpen(false)}>Cancel</Button>
            <Button onClick={() => addToCol.mutate()} disabled={!colId || addToCol.isPending}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
