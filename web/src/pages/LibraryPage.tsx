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
    enabled: !!libraryId,
  })
  const { data: tree = [] } = useQuery({
    queryKey: ['categories', libraryId],
    queryFn: () => api.libraries.categories(libraryId!),
    enabled: !!libraryId,
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
      qc.invalidateQueries({ queryKey: ['categories'] })
      setDeleteCat(null)
    },
  })

  const openEditCat = (cat: Category) => { setEditCat(cat); setEditCatName(cat.name) }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{library?.icon} {library?.name}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{tree.length} {tree.length === 1 ? 'category' : 'categories'}</p>
      </div>

      <section>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Categories</h2>
          <Button size="sm" variant="outline" onClick={() => setNewCatOpen(true)} className="gap-1.5 self-start">
            <Plus size={14} />New Category
          </Button>
        </div>

        {tree.length === 0 && (
          <div className="text-center py-16">
            <Plus size={32} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No categories yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create categories to organize files in this library</p>
          </div>
        )}

        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
          {tree.map(cat => (
            <div key={cat.id} className="relative group">
              <button
                onClick={() => navigate(`/categories/${cat.id}`)}
                className="w-full p-5 rounded-xl border bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 text-left"
              >
                <p className="font-semibold text-sm">{cat.name}</p>
                {cat.children && cat.children.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1.5">{cat.children.length} subcategories</p>
                )}
              </button>
              <div className="absolute top-3 right-3 flex gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7 bg-card/80 backdrop-blur-sm" onClick={e => { e.stopPropagation(); openEditCat(cat) }}>
                  <Pencil size={12} />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 bg-card/80 backdrop-blur-sm text-destructive hover:text-destructive" onClick={e => { e.stopPropagation(); setDeleteCat(cat) }}>
                  <Trash2 size={12} />
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
