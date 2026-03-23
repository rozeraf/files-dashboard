// web/src/pages/CollectionsPage.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Collection } from '@/lib/api'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Library } from 'lucide-react'

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
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Collections</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Curated groups of files</p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5 self-start">
          <Plus size={14} />New Collection
        </Button>
      </div>

      {data.length === 0 ? (
        <div className="text-center py-20">
          <Library size={32} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No collections yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create collections to group related files together</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
          {data.map(col => (
            <div key={col.id} className="relative group">
              <button
                className="w-full p-5 rounded-xl border bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 text-left"
                onClick={() => navigate(`/collections/${col.id}`)}
              >
                <p className="font-semibold text-sm">{col.name}</p>
                {col.description && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{col.description}</p>}
              </button>
              <div className="absolute top-3 right-3 flex gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7 bg-card/80 backdrop-blur-sm" onClick={e => { e.stopPropagation(); openEdit(col) }}>
                  <Pencil size={12} />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 bg-card/80 backdrop-blur-sm text-destructive hover:text-destructive" onClick={e => { e.stopPropagation(); setDeleteCol(col) }}>
                  <Trash2 size={12} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={o => !o && setCreateOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Collection</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Name" value={name} onChange={e => setName(e.target.value)} autoFocus />
            <Input placeholder="Description (optional)" value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editCol} onOpenChange={o => !o && setEditCol(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Collection</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={name} onChange={e => setName(e.target.value)} autoFocus />
            <Input placeholder="Description (optional)" value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCol(null)}>Cancel</Button>
            <Button onClick={() => update.mutate()} disabled={!name || update.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
