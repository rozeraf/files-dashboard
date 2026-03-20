// web/src/pages/FilesPage.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Entry } from '@/lib/api'
import { useRef, useState } from 'react'
import { EntryDetailPanel } from '@/components/ui/EntryDetailPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ChevronRight, FolderPlus, Upload, Pencil, Trash2 } from 'lucide-react'
import { formatSize, formatDate, mimeToIcon } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function FilesPage() {
  const [rootId, setRootId] = useState<string | null>(null)
  const [path, setPath] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [mkdirOpen, setMkdirOpen] = useState(false)
  const [mkdirName, setMkdirName] = useState('')
  const [renameEntry, setRenameEntry] = useState<Entry | null>(null)
  const [renameName, setRenameName] = useState('')
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const invalidate = () => qc.invalidateQueries({ queryKey: ['fs-entries', rootId, path] })

  const { data: roots = [] } = useQuery({ queryKey: ['roots'], queryFn: api.roots.list })
  const { data: entries = [] } = useQuery({
    queryKey: ['fs-entries', rootId, path],
    queryFn: () => api.fs.list(rootId!, path),
    enabled: !!rootId,
  })

  const mkdir = useMutation({
    mutationFn: () => api.fs.mkdir(rootId!, path, mkdirName),
    onSuccess: () => { invalidate(); setMkdirOpen(false); setMkdirName('') },
  })

  const rename = useMutation({
    mutationFn: () => api.fs.rename(renameEntry!.id, renameName),
    onSuccess: () => { invalidate(); setRenameEntry(null) },
  })

  const deleteMut = useMutation({
    mutationFn: () => api.fs.delete(deleteIds!),
    onSuccess: () => { invalidate(); setDeleteIds(null) },
  })

  const handleUpload = (files: FileList | null) => {
    if (!files || !rootId) return
    Array.from(files).forEach(file =>
      api.fs.upload(rootId, path, file).then(invalidate)
    )
  }

  const openRename = (e: Entry) => { setRenameEntry(e); setRenameName(e.name) }

  const breadcrumbs = path.split('/').filter(Boolean)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Files</h1>

      {/* Root selector */}
      <div className="flex gap-2 flex-wrap">
        {roots.map(r => (
          <Button key={r.id} variant={rootId === r.id ? 'default' : 'outline'} size="sm"
            onClick={() => { setRootId(r.id); setPath('') }}>
            {r.label}
          </Button>
        ))}
      </div>

      {rootId && (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} className="mr-1.5" />Upload
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMkdirOpen(true)}>
              <FolderPlus size={14} className="mr-1.5" />New Folder
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={e => handleUpload(e.target.files)}
            />
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <button onClick={() => setPath('')} className="hover:text-foreground">root</button>
            {breadcrumbs.map((seg, i, arr) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight size={12} />
                <button
                  onClick={() => setPath(arr.slice(0, i + 1).join('/'))}
                  className="hover:text-foreground"
                >{seg}</button>
              </span>
            ))}
          </div>

          {/* File table */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Size</th>
                <th className="pb-2 font-medium">Modified</th>
                <th className="pb-2 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr
                  key={entry.id}
                  className={cn('border-b hover:bg-muted/50 transition-colors group')}
                >
                  <td
                    className="py-2 flex items-center gap-2 cursor-pointer"
                    onClick={() => entry.kind === 'dir' ? setPath(entry.rel_path) : setDetailId(entry.id)}
                  >
                    <span>{entry.kind === 'dir' ? '📁' : mimeToIcon(entry.mime, entry.kind)}</span>
                    <span className="truncate max-w-xs">{entry.name}</span>
                  </td>
                  <td className="py-2 text-muted-foreground">{formatSize(entry.size)}</td>
                  <td className="py-2 text-muted-foreground">{formatDate(entry.mtime)}</td>
                  <td className="py-2">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        title="Rename"
                        onClick={e => { e.stopPropagation(); openRename(entry) }}
                      >
                        <Pencil size={13} />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        title="Delete"
                        onClick={e => { e.stopPropagation(); setDeleteIds([entry.id]) }}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* New Folder dialog */}
      <Dialog open={mkdirOpen} onOpenChange={setMkdirOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Folder</DialogTitle></DialogHeader>
          <Input
            placeholder="Folder name"
            value={mkdirName}
            onChange={e => setMkdirName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && mkdirName && mkdir.mutate()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMkdirOpen(false)}>Cancel</Button>
            <Button onClick={() => mkdir.mutate()} disabled={!mkdirName || mkdir.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameEntry} onOpenChange={o => !o && setRenameEntry(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename</DialogTitle></DialogHeader>
          <Input
            value={renameName}
            onChange={e => setRenameName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && renameName && rename.mutate()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameEntry(null)}>Cancel</Button>
            <Button onClick={() => rename.mutate()} disabled={!renameName || rename.isPending}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteIds} onOpenChange={o => !o && setDeleteIds(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete {deleteIds?.length === 1 ? 'item' : `${deleteIds?.length} items`}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete the file(s) from disk. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteIds(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EntryDetailPanel
        entryId={detailId}
        onClose={() => setDetailId(null)}
        onDeleted={() => { setDetailId(null); invalidate() }}
        onRenamed={() => invalidate()}
      />
    </div>
  )
}
