// web/src/components/layout/Header.tsx
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Sun, Moon, Monitor, Upload, FilePlus } from 'lucide-react'
import { useUI } from '@/stores/ui'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function Header() {
  const { theme, setTheme } = useUI()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [q, setQ] = useState('')

  // Upload state
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadRootId, setUploadRootId] = useState('')
  const [uploadPath, setUploadPath] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Create text file state
  const [createOpen, setCreateOpen] = useState(false)
  const [createRootId, setCreateRootId] = useState('')
  const [createPath, setCreatePath] = useState('')
  const [createName, setCreateName] = useState('untitled.txt')
  const [createContent, setCreateContent] = useState('')
  const [creating, setCreating] = useState(false)

  const { data: roots = [] } = useQuery({ queryKey: ['roots'], queryFn: api.roots.list })

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`)
  }

  const nextTheme = () => {
    const cycle: Record<string, 'light' | 'dark' | 'system'> = { light: 'dark', dark: 'system', system: 'light' }
    setTheme(cycle[theme])
  }

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor

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
      await Promise.all(Array.from(files).map(f => api.fs.upload(uploadRootId, uploadPath, f)))
      qc.invalidateQueries({ queryKey: ['fs-entries'] })
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
      await api.fs.upload(createRootId, createPath, file)
      qc.invalidateQueries({ queryKey: ['fs-entries'] })
      setCreateOpen(false)
    } finally {
      setCreating(false)
    }
  }

  return (
    <header className="h-14 border-b px-6 flex items-center gap-3 shrink-0">
      <form onSubmit={onSearch} className="flex-1 max-w-xl">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search files, categories, tags…"
            className="pl-9"
          />
        </div>
      </form>

      <Button variant="outline" size="sm" onClick={openUpload} disabled={roots.length === 0} title="Upload files">
        <Upload size={14} className="mr-1.5" />Upload
      </Button>
      <Button variant="outline" size="sm" onClick={openCreate} disabled={roots.length === 0} title="Create text file">
        <FilePlus size={14} className="mr-1.5" />Create
      </Button>

      <Button variant="ghost" size="icon" onClick={nextTheme} title="Toggle theme">
        <ThemeIcon size={18} />
      </Button>

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={o => !o && setUploadOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload Files</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Root</p>
              <Select value={uploadRootId} onValueChange={setUploadRootId}>
                <SelectTrigger><SelectValue placeholder="Select root…" /></SelectTrigger>
                <SelectContent>
                  {roots.map(r => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Path (optional)</p>
              <Input placeholder="e.g. docs/2026" value={uploadPath} onChange={e => setUploadPath(e.target.value)} />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              onChange={e => handleUpload(e.target.files)}
              disabled={uploading}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create text file dialog */}
      <Dialog open={createOpen} onOpenChange={o => !o && setCreateOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Text File</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Root</p>
                <Select value={createRootId} onValueChange={setCreateRootId}>
                  <SelectTrigger><SelectValue placeholder="Select root…" /></SelectTrigger>
                  <SelectContent>
                    {roots.map(r => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Path (optional)</p>
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
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  )
}
