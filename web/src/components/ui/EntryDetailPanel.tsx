// web/src/components/ui/EntryDetailPanel.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatSize, formatDate, mimeToIcon } from '@/lib/utils'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Heart, HeartOff, Pencil, Trash2 } from 'lucide-react'

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

  const { data } = useQuery({
    queryKey: ['entry', entryId],
    queryFn: () => api.entries.get(entryId!),
    enabled: !!entryId,
  })

  const toggleFav = useMutation({
    mutationFn: () => data?.favorited
      ? api.favorites.remove(entryId!)
      : api.favorites.add(entryId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entry', entryId] }),
  })

  const rename = useMutation({
    mutationFn: () => api.fs.rename(entryId!, renameName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entry', entryId] })
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
            {data.categories.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Categories</p>
                <div className="flex flex-wrap gap-1">
                  {data.categories.map(c => <Badge key={c.id} variant="secondary">{c.name}</Badge>)}
                </div>
              </div>
            )}

            {/* Tags */}
            {data.tags.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {data.tags.map(t => (
                    <Badge key={t.id} style={{ backgroundColor: t.color || undefined }} variant="outline">{t.name}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Rename dialog — outside Sheet to avoid z-index issues */}
      <Dialog open={renameOpen} onOpenChange={o => !o && setRenameOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename</DialogTitle></DialogHeader>
          <Input
            value={renameName}
            onChange={e => setRenameName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && renameName && rename.mutate()}
            autoFocus
          />
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
    </>
  )
}
