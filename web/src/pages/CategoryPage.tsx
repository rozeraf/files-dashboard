// web/src/pages/CategoryPage.tsx
import { useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { EntryGrid } from '@/components/ui/EntryGrid'
import { EntryTable } from '@/components/ui/EntryTable'
import { EntryDetailPanel } from '@/components/ui/EntryDetailPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LayoutGrid, List, Pencil, Trash2, Upload, FilePlus, FolderPlus } from 'lucide-react'
import { ErrorState, LoadingState } from '@/components/ui/state'
import { usePasteUpload, asFileList } from '@/hooks/usePasteUpload'

export function CategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [view, setView] = useState<'grid' | 'table'>('grid')
  const [detailId, setDetailId] = useState<string | null>(null)

  // category actions
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameName, setRenameName] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)

  // upload
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadRootId, setUploadRootId] = useState('')
  const [uploadPath, setUploadPath] = useState('')
  const [uploading, setUploading] = useState(false)

  // subcategory
  const [newSubcatOpen, setNewSubcatOpen] = useState(false)
  const [newSubcatName, setNewSubcatName] = useState('')

  // create text file
  const [createOpen, setCreateOpen] = useState(false)
  const [createRootId, setCreateRootId] = useState('')
  const [createPath, setCreatePath] = useState('')
  const [createName, setCreateName] = useState('untitled.txt')
  const [createContent, setCreateContent] = useState('')
  const [creating, setCreating] = useState(false)

  const rootsQuery = useQuery({ queryKey: ['roots'], queryFn: api.roots.list })

  const subcategoriesQuery = useQuery({
    queryKey: ['subcategories', categoryId],
    queryFn: () => api.categories.subcategories(categoryId!),
    enabled: !!categoryId,
  })

  const categoryQuery = useQuery({
    queryKey: ['category', categoryId],
    queryFn: () => api.categories.get(categoryId!),
    enabled: !!categoryId,
  })

  const entriesQuery = useQuery({
    queryKey: ['category-entries', categoryId],
    queryFn: () => api.categories.entries(categoryId!),
    enabled: !!categoryId,
  })
  const roots = rootsQuery.data ?? []
  const subcategories = subcategoriesQuery.data ?? []
  const category = categoryQuery.data
  const entries = entriesQuery.data?.items ?? []

  const invalidateEntries = () => qc.invalidateQueries({ queryKey: ['category-entries', categoryId] })

  const createSubcat = useMutation({
    mutationFn: () => api.categories.create(category!.library_id, categoryId!, newSubcatName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subcategories', categoryId] })
      qc.invalidateQueries({ queryKey: ['categories'] })
      setNewSubcatOpen(false)
      setNewSubcatName('')
    },
  })

  const openUpload = () => {
    setUploadRootId(roots[0]?.id ?? '')
    setUploadPath('')
    setUploadOpen(true)
  }

  const openCreate = () => {
    setCreateRootId(roots[0]?.id ?? '')
    setCreatePath('')
    setCreateName('untitled.txt')
    setCreateContent('')
    setCreateOpen(true)
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files || !uploadRootId) return
    setUploading(true)
    try {
      await Promise.allSettled(Array.from(files).map(async file => {
        const entry = await api.fs.upload(uploadRootId, uploadPath, file)
        if (entry.id) await api.entries.assignCategories(entry.id, [categoryId!], [])
      }))
      invalidateEntries()
      setUploadOpen(false)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleCreate = async () => {
    if (!createRootId || !createName) return
    setCreating(true)
    try {
      const file = new File([createContent], createName, { type: 'text/plain' })
      const entry = await api.fs.upload(createRootId, createPath, file)
      if (entry.id) await api.entries.assignCategories(entry.id, [categoryId!], [])
      invalidateEntries()
      setCreateOpen(false)
    } finally {
      setCreating(false)
    }
  }

  usePasteUpload(
    files => handleUpload(asFileList(files)),
    uploadOpen && !!uploadRootId,
  )

  const openRename = () => { setRenameName(category?.name ?? ''); setRenameOpen(true) }

  const rename = useMutation({
    mutationFn: () => api.categories.update(categoryId!, { name: renameName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['category', categoryId] })
      qc.invalidateQueries({ queryKey: ['categories'] })
      setRenameOpen(false)
    },
  })

  const del = useMutation({
    mutationFn: () => api.categories.delete(categoryId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      navigate(-1)
    },
  })

  if (categoryQuery.isPending || subcategoriesQuery.isPending || entriesQuery.isPending) {
    return <LoadingState title="Loading category" description="Preparing subcategories and assigned files." />
  }

  if (categoryQuery.error || subcategoriesQuery.error || entriesQuery.error) {
    return (
      <ErrorState
        title="Couldn't load this category"
        error={categoryQuery.error ?? subcategoriesQuery.error ?? entriesQuery.error}
        onRetry={() => {
          void categoryQuery.refetch()
          void subcategoriesQuery.refetch()
          void entriesQuery.refetch()
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{category?.name ?? 'Category'}</h1>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openRename}>
            <Pencil size={14} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 size={14} />
          </Button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setNewSubcatOpen(true)} className="gap-1.5">
            <FolderPlus size={14} /><span className="hidden sm:inline">Subcategory</span>
          </Button>
          <Button variant="outline" size="sm" onClick={openUpload} disabled={roots.length === 0} className="gap-1.5">
            <Upload size={14} /><span className="hidden sm:inline">Upload</span>
          </Button>
          <Button variant="outline" size="sm" onClick={openCreate} disabled={roots.length === 0} className="gap-1.5">
            <FilePlus size={14} /><span className="hidden sm:inline">Create</span>
          </Button>
          <div className="flex gap-1 border-l pl-2 ml-1">
            <Button variant={view === 'grid' ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setView('grid')}><LayoutGrid size={15} /></Button>
            <Button variant={view === 'table' ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setView('table')}><List size={15} /></Button>
          </div>
        </div>
      </div>

      {/* Subcategories */}
      {subcategories.length > 0 && (
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
          {subcategories.map(sub => (
            <button
              key={sub.id}
              onClick={() => navigate(`/categories/${sub.id}`)}
              className="p-4 rounded-xl border bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 text-left"
            >
              <p className="font-medium text-sm">{sub.name}</p>
            </button>
          ))}
        </div>
      )}

      {view === 'grid'
        ? <EntryGrid entries={entries} onSelect={e => setDetailId(e.id)} />
        : <EntryTable entries={entries} onSelect={e => setDetailId(e.id)} />
      }

      <EntryDetailPanel entryId={detailId} onClose={() => setDetailId(null)}
        onDeleted={() => { setDetailId(null); invalidateEntries() }}
        onRenamed={invalidateEntries} />

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={o => !o && setUploadOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload to "{category?.name}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Store in</p>
              <Select value={uploadRootId} onValueChange={setUploadRootId}>
                <SelectTrigger><SelectValue placeholder="Select root…" /></SelectTrigger>
                <SelectContent>
                  {roots.map(r => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Folder path (optional)</p>
              <Input placeholder="e.g. photos/2026" value={uploadPath} onChange={e => setUploadPath(e.target.value)} />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              disabled={uploading}
              className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              onChange={e => handleUpload(e.target.files)}
            />
            {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
            {!uploading && uploadRootId && (
              <p className="text-xs text-muted-foreground">or paste Ctrl+V to upload from clipboard</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create text file dialog */}
      <Dialog open={createOpen} onOpenChange={o => !o && setCreateOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New file in "{category?.name}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Store in</p>
                <Select value={createRootId} onValueChange={setCreateRootId}>
                  <SelectTrigger><SelectValue placeholder="Select root…" /></SelectTrigger>
                  <SelectContent>
                    {roots.map(r => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Folder path (optional)</p>
                <Input placeholder="e.g. notes" value={createPath} onChange={e => setCreatePath(e.target.value)} />
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Filename</p>
              <Input value={createName} onChange={e => setCreateName(e.target.value)} autoFocus />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Content (optional)</p>
              <textarea
                value={createContent}
                onChange={e => setCreateContent(e.target.value)}
                rows={6}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="File content…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!createName || !createRootId || creating}>
              {creating ? 'Creating…' : 'Create & assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
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

      {/* Delete dialog */}
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

      {/* New subcategory dialog */}
      <Dialog open={newSubcatOpen} onOpenChange={o => !o && setNewSubcatOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Subcategory</DialogTitle></DialogHeader>
          <Input
            placeholder="Subcategory name"
            value={newSubcatName}
            onChange={e => setNewSubcatName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && newSubcatName && createSubcat.mutate()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSubcatOpen(false)}>Cancel</Button>
            <Button onClick={() => createSubcat.mutate()} disabled={!newSubcatName || createSubcat.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
