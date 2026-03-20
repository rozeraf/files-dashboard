// web/src/pages/CategoryPage.tsx
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState } from 'react'
import { EntryGrid } from '@/components/ui/EntryGrid'
import { EntryTable } from '@/components/ui/EntryTable'
import { EntryDetailPanel } from '@/components/ui/EntryDetailPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { LayoutGrid, List, Pencil, Trash2 } from 'lucide-react'

export function CategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [view, setView] = useState<'grid' | 'table'>('grid')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameName, setRenameName] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: category } = useQuery({
    queryKey: ['category', categoryId],
    queryFn: () => api.categories.get(categoryId!),
  })

  const { data } = useQuery({
    queryKey: ['category-entries', categoryId],
    queryFn: () => api.categories.entries(categoryId!),
  })
  const entries = data?.items ?? []

  const openRename = () => { setRenameName(category?.name ?? ''); setRenameOpen(true) }

  const rename = useMutation({
    mutationFn: () => api.categories.update(categoryId!, { name: renameName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['category', categoryId] })
      qc.invalidateQueries({ queryKey: ['sidebar-categories'] })
      setRenameOpen(false)
    },
  })

  const del = useMutation({
    mutationFn: () => api.categories.delete(categoryId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sidebar-categories'] })
      navigate(-1)
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{category?.name ?? 'Category'}</h1>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openRename}>
            <Pencil size={14} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 size={14} />
          </Button>
        </div>
        <div className="flex gap-1">
          <Button variant={view === 'grid' ? 'default' : 'ghost'} size="icon" onClick={() => setView('grid')}><LayoutGrid size={16} /></Button>
          <Button variant={view === 'table' ? 'default' : 'ghost'} size="icon" onClick={() => setView('table')}><List size={16} /></Button>
        </div>
      </div>

      {view === 'grid'
        ? <EntryGrid entries={entries} onSelect={e => setDetailId(e.id)} />
        : <EntryTable entries={entries} onSelect={e => setDetailId(e.id)} />
      }

      <EntryDetailPanel entryId={detailId} onClose={() => setDetailId(null)} />

      <Dialog open={renameOpen} onOpenChange={o => !o && setRenameOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename Category</DialogTitle></DialogHeader>
          <Input value={renameName} onChange={e => setRenameName(e.target.value)} autoFocus
            onKeyDown={e => e.key === 'Enter' && renameName && rename.mutate()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={() => rename.mutate()} disabled={!renameName || rename.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={o => !o && setDeleteOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete "{category?.name}"?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">All entries will become uncategorized. Files on disk are not affected.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => del.mutate()} disabled={del.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
