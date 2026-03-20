// web/src/pages/CollectionsPage.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Collection } from '@/lib/api'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2 } from 'lucide-react'

export function CollectionsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data = [] } = useQuery({ queryKey: ['collections'], queryFn: api.collections.list })

  const [createOpen, setCreateOpen] = useState(false)
  const [editCol, setEditCol] = useState<Collection | null>(null)
  const [deleteCol, setDeleteCol] = useState<Collection | null>(null)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')

  const invalidate = () => qc.invalidateQueries({ queryKey: ['collections'] })

  const create = useMutation({
    mutationFn: () => api.collections.create(name, desc),
    onSuccess: () => { invalidate(); setCreateOpen(false); setName(''); setDesc('') },
  })

  const update = useMutation({
    mutationFn: () => api.collections.update(editCol!.id, { name, description: desc }),
    onSuccess: () => { invalidate(); setEditCol(null) },
  })

  const del = useMutation({
    mutationFn: () => api.collections.delete(deleteCol!.id),
    onSuccess: () => { invalidate(); setDeleteCol(null) },
  })

  const openCreate = () => { setName(''); setDesc(''); setCreateOpen(true) }
  const openEdit = (col: Collection) => { setEditCol(col); setName(col.name); setDesc(col.description) }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Collections</h1>
        <Button size="sm" onClick={openCreate}><Plus size={14} className="mr-1" />New Collection</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {data.map(col => (
          <div key={col.id} className="relative group p-4 rounded-xl border bg-card hover:border-primary/50 hover:shadow-sm transition-all">
            <button className="w-full text-left" onClick={() => navigate(`/collections/${col.id}`)}>
              <p className="font-medium">{col.name}</p>
              {col.description && <p className="text-xs text-muted-foreground mt-1">{col.description}</p>}
            </button>
            <div className="absolute top-2 right-2 hidden group-hover:flex gap-0.5">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); openEdit(col) }}>
                <Pencil size={11} />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={e => { e.stopPropagation(); setDeleteCol(col) }}>
                <Trash2 size={11} />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={o => !o && setCreateOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Collection</DialogTitle></DialogHeader>
          <Input placeholder="Name" value={name} onChange={e => setName(e.target.value)} autoFocus />
          <Input placeholder="Description (optional)" value={desc} onChange={e => setDesc(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editCol} onOpenChange={o => !o && setEditCol(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Collection</DialogTitle></DialogHeader>
          <Input value={name} onChange={e => setName(e.target.value)} autoFocus />
          <Input placeholder="Description (optional)" value={desc} onChange={e => setDesc(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCol(null)}>Cancel</Button>
            <Button onClick={() => update.mutate()} disabled={!name || update.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!deleteCol} onOpenChange={o => !o && setDeleteCol(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete "{deleteCol?.name}"?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">The collection will be deleted but files will remain on disk.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCol(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => del.mutate()} disabled={del.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
