// web/src/pages/TagsPage.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Tag } from '@/lib/api'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Tag as TagIcon } from 'lucide-react'

export function TagsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data = [] } = useQuery({ queryKey: ['tags'], queryFn: api.tags.list })

  const [createOpen, setCreateOpen] = useState(false)
  const [editTag, setEditTag] = useState<Tag | null>(null)
  const [deleteTag, setDeleteTag] = useState<Tag | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#d97706')

  const invalidate = () => qc.invalidateQueries({ queryKey: ['tags'] })

  const create = useMutation({
    mutationFn: () => api.tags.create(name, color),
    onSuccess: () => { invalidate(); setCreateOpen(false); setName(''); setColor('#d97706') },
  })

  const update = useMutation({
    mutationFn: () => api.tags.update(editTag!.id, { name, color }),
    onSuccess: () => { invalidate(); setEditTag(null) },
  })

  const del = useMutation({
    mutationFn: () => api.tags.delete(deleteTag!.id),
    onSuccess: () => { invalidate(); setDeleteTag(null) },
  })

  const openEdit = (tag: Tag) => { setEditTag(tag); setName(tag.name); setColor(tag.color || '#d97706') }
  const openCreate = () => { setName(''); setColor('#d97706'); setCreateOpen(true) }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tags</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{data.length} {data.length === 1 ? 'tag' : 'tags'}</p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5 self-start">
          <Plus size={14} />New Tag
        </Button>
      </div>

      {data.length === 0 ? (
        <div className="text-center py-20">
          <TagIcon size={32} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No tags yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create tags to organize your files</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {data.map(tag => (
            <div key={tag.id} className="flex items-center gap-1 group">
              <button onClick={() => navigate(`/search?tags=${tag.id}`)}>
                <Badge
                  style={{ backgroundColor: tag.color || undefined }}
                  className="cursor-pointer text-sm px-3 py-1.5 transition-all hover:opacity-80 shadow-sm"
                >
                  {tag.name}
                </Badge>
              </button>
              <div className="flex gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(tag)}>
                  <Pencil size={11} />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => setDeleteTag(tag)}>
                  <Trash2 size={11} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={o => !o && setCreateOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Tag</DialogTitle></DialogHeader>
          <div className="flex gap-2">
            <Input placeholder="Tag name" value={name} onChange={e => setName(e.target.value)} autoFocus
              onKeyDown={e => e.key === 'Enter' && name && create.mutate()} />
            <input type="color" value={color} onChange={e => setColor(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-lg border border-input p-0.5" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTag} onOpenChange={o => !o && setEditTag(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Tag</DialogTitle></DialogHeader>
          <div className="flex gap-2">
            <Input value={name} onChange={e => setName(e.target.value)} autoFocus
              onKeyDown={e => e.key === 'Enter' && name && update.mutate()} />
            <input type="color" value={color} onChange={e => setColor(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-lg border border-input p-0.5" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTag(null)}>Cancel</Button>
            <Button onClick={() => update.mutate()} disabled={!name || update.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTag} onOpenChange={o => !o && setDeleteTag(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete "{deleteTag?.name}"?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will remove the tag from all entries.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTag(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => del.mutate()} disabled={del.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
