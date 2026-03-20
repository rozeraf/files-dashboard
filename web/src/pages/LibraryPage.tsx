// web/src/pages/LibraryPage.tsx
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Category } from '@/lib/api'
import { useState } from 'react'
import { EntryDetailPanel } from '@/components/ui/EntryDetailPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2 } from 'lucide-react'

export function LibraryPage() {
  const { libraryId } = useParams<{ libraryId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [detailId, setDetailId] = useState<string | null>(null)

  const [newCatOpen, setNewCatOpen] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [editCat, setEditCat] = useState<Category | null>(null)
  const [editCatName, setEditCatName] = useState('')
  const [deleteCat, setDeleteCat] = useState<Category | null>(null)

  const { data: library } = useQuery({
    queryKey: ['library', libraryId],
    queryFn: () => api.libraries.get(libraryId!),
  })
  const { data: tree = [] } = useQuery({
    queryKey: ['categories', libraryId],
    queryFn: () => api.libraries.categories(libraryId!),
  })

  const invalidateCats = () => qc.invalidateQueries({ queryKey: ['categories', libraryId] })

  const createCat = useMutation({
    mutationFn: () => api.categories.create(libraryId!, null, newCatName),
    onSuccess: () => { invalidateCats(); setNewCatOpen(false); setNewCatName('') },
  })

  const updateCat = useMutation({
    mutationFn: () => api.categories.update(editCat!.id, { name: editCatName }),
    onSuccess: () => { invalidateCats(); setEditCat(null) },
  })

  const delCat = useMutation({
    mutationFn: () => api.categories.delete(deleteCat!.id),
    onSuccess: () => {
      invalidateCats()
      qc.invalidateQueries({ queryKey: ['sidebar-categories'] })
      setDeleteCat(null)
    },
  })

  const openEditCat = (cat: Category) => { setEditCat(cat); setEditCatName(cat.name) }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{library?.icon} {library?.name}</h1>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Categories</h2>
          <Button size="sm" variant="outline" onClick={() => setNewCatOpen(true)}>
            <Plus size={14} className="mr-1" />New Category
          </Button>
        </div>

        {tree.length === 0 && (
          <p className="text-sm text-muted-foreground">No categories yet.</p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {tree.map(cat => (
            <div key={cat.id} className="relative group">
              <button
                onClick={() => navigate(`/categories/${cat.id}`)}
                className="w-full p-4 rounded-xl border bg-card hover:border-primary/50 hover:shadow-sm transition-all text-left"
              >
                <p className="font-medium text-sm">{cat.name}</p>
                {cat.children && cat.children.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{cat.children.length} subcategories</p>
                )}
              </button>
              <div className="absolute top-2 right-2 hidden group-hover:flex gap-0.5">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); openEditCat(cat) }}>
                  <Pencil size={11} />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={e => { e.stopPropagation(); setDeleteCat(cat) }}>
                  <Trash2 size={11} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* New category dialog */}
      <Dialog open={newCatOpen} onOpenChange={o => !o && setNewCatOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Category</DialogTitle></DialogHeader>
          <Input placeholder="Category name" value={newCatName} onChange={e => setNewCatName(e.target.value)} autoFocus
            onKeyDown={e => e.key === 'Enter' && newCatName && createCat.mutate()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCatOpen(false)}>Cancel</Button>
            <Button onClick={() => createCat.mutate()} disabled={!newCatName || createCat.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit category dialog */}
      <Dialog open={!!editCat} onOpenChange={o => !o && setEditCat(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename Category</DialogTitle></DialogHeader>
          <Input value={editCatName} onChange={e => setEditCatName(e.target.value)} autoFocus
            onKeyDown={e => e.key === 'Enter' && editCatName && updateCat.mutate()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCat(null)}>Cancel</Button>
            <Button onClick={() => updateCat.mutate()} disabled={!editCatName || updateCat.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete category dialog */}
      <Dialog open={!!deleteCat} onOpenChange={o => !o && setDeleteCat(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete "{deleteCat?.name}"?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">All entries in this category will become uncategorized.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCat(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => delCat.mutate()} disabled={delCat.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EntryDetailPanel entryId={detailId} onClose={() => setDetailId(null)}
        onDeleted={() => setDetailId(null)} />
    </div>
  )
}
