// web/src/pages/TagsPage.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Tag } from '@/lib/api'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2 } from 'lucide-react'

export function TagsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data = [] } = useQuery({ queryKey: ['tags'], queryFn: api.tags.list })

  const [createOpen, setCreateOpen] = useState(false)
  const [editTag, setEditTag] = useState<Tag | null>(null)
  const [deleteTag, setDeleteTag] = useState<Tag | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#6366f1')

  const invalidate = () => qc.invalidateQueries({ queryKey: ['tags'] })

  const create = useMutation({
    mutationFn: () => api.tags.create(name, color),
    onSuccess: () => { invalidate(); setCreateOpen(false); setName(''); setColor('#6366f1') },
  })

  const update = useMutation({
    mutationFn: () => api.tags.update(editTag!.id, { name, color }),
    onSuccess: () => { invalidate(); setEditTag(null) },
  })

  const del = useMutation({
    mutationFn: () => api.tags.delete(deleteTag!.id),
    onSuccess: () => { invalidate(); setDeleteTag(null) },
  })

  const openEdit = (tag: Tag) => { setEditTag(tag); setName(tag.name); setColor(tag.color || '#6366f1') }
  const openCreate = () => { setName(''); setColor('#6366f1'); setCreateOpen(true) }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tags</h1>
        <Button size="sm" onClick={openCreate}><Plus size={14} className="mr-1" />New Tag</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {data.map(tag => (
          <div key={tag.id} className="flex items-center gap-1 group">
            <button onClick={() => navigate(`/search?tags=${tag.id}`)}>
              <Badge style={{ backgroundColor: tag.color || undefined }} className="cursor-pointer text-sm px-3 py-1">
                {tag.name}
              </Badge>
            </button>
            <div className="hidden group-hover:flex gap-0.5">
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

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={o => !o && setCreateOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Tag</DialogTitle></DialogHeader>
          <div className="flex gap-2">
            <Input placeholder="Tag name" value={name} onChange={e => setName(e.target.value)} autoFocus
              onKeyDown={e => e.key === 'Enter' && name && create.mutate()} />
            <input type="color" value={color} onChange={e => setColor(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-input p-0.5" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTag} onOpenChange={o => !o && setEditTag(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Tag</DialogTitle></DialogHeader>
          <div className="flex gap-2">
            <Input value={name} onChange={e => setName(e.target.value)} autoFocus
              onKeyDown={e => e.key === 'Enter' && name && update.mutate()} />
            <input type="color" value={color} onChange={e => setColor(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-input p-0.5" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTag(null)}>Cancel</Button>
            <Button onClick={() => update.mutate()} disabled={!name || update.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
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
