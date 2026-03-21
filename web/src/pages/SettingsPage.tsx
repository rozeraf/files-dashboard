// web/src/pages/SettingsPage.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Library } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useState } from 'react'
import { Trash2, Plus, RefreshCw, Pencil, AlertTriangle } from 'lucide-react'

export function SettingsPage() {
  const qc = useQueryClient()
  const { data: config } = useQuery({ queryKey: ['config'], queryFn: api.config.get })
  const { data: libraries = [] } = useQuery({ queryKey: ['libraries'], queryFn: api.libraries.list })

  // Roots
  const [newPath, setNewPath] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [editRootId, setEditRootId] = useState<string | null>(null)
  const [editRootLabel, setEditRootLabel] = useState('')

  // Scan
  const [scanJobId, setScanJobId] = useState<string | null>(null)

  // Libraries
  const [newLibOpen, setNewLibOpen] = useState(false)
  const [newLibName, setNewLibName] = useState('')
  const [newLibIcon, setNewLibIcon] = useState('📁')
  const [editLib, setEditLib] = useState<Library | null>(null)
  const [editLibName, setEditLibName] = useState('')
  const [editLibIcon, setEditLibIcon] = useState('')
  const [deleteLib, setDeleteLib] = useState<Library | null>(null)

  // App config
  const [editAppName, setEditAppName] = useState('')
  const [editAppNameOpen, setEditAppNameOpen] = useState(false)

  // Reset
  const [resetOpen, setResetOpen] = useState(false)

  const addRoot = useMutation({
    mutationFn: () => api.roots.create({ path: newPath, label: newLabel }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['config'] })
      qc.invalidateQueries({ queryKey: ['roots'] })
      setNewPath(''); setNewLabel('')
    },
  })

  const updateRoot = useMutation({
    mutationFn: () => api.roots.update(editRootId!, editRootLabel),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['config'] })
      qc.invalidateQueries({ queryKey: ['roots'] })
      setEditRootId(null)
    },
  })

  const deleteRoot = useMutation({
    mutationFn: (id: string) => api.roots.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['config'] })
      qc.invalidateQueries({ queryKey: ['roots'] })
    },
  })

  const startScan = useMutation({
    mutationFn: api.scan.start,
    onSuccess: (job) => setScanJobId(job.jobId),
  })

  const { data: scanJob } = useQuery({
    queryKey: ['scan', scanJobId],
    queryFn: () => api.scan.status(scanJobId!),
    enabled: !!scanJobId,
    refetchInterval: (q) => q.state.data?.status === 'running' ? 1000 : false,
  })

  const createLib = useMutation({
    mutationFn: () => api.libraries.create(newLibName, newLibIcon),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['libraries'] })
      qc.invalidateQueries({ queryKey: ['sidebar-libraries'] })
      setNewLibOpen(false); setNewLibName(''); setNewLibIcon('📁')
    },
  })

  const updateLib = useMutation({
    mutationFn: () => api.libraries.update(editLib!.id, { name: editLibName, icon: editLibIcon }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['libraries'] })
      qc.invalidateQueries({ queryKey: ['sidebar-libraries'] })
      setEditLib(null)
    },
  })

  const delLib = useMutation({
    mutationFn: () => api.libraries.delete(deleteLib!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['libraries'] })
      qc.invalidateQueries({ queryKey: ['sidebar-libraries'] })
      setDeleteLib(null)
    },
  })

  const updateAppName = useMutation({
    mutationFn: () => api.config.update({ app_name: editAppName }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['config'] }); setEditAppNameOpen(false) },
  })

  const resetDB = useMutation({
    mutationFn: async () => {
      await api.reset()
      const job = await api.scan.start()
      return job
    },
    onSuccess: (job) => {
      setScanJobId(job.jobId)
      setResetOpen(false)
      qc.invalidateQueries()
    },
  })

  const openEditLib = (lib: Library) => { setEditLib(lib); setEditLibName(lib.name); setEditLibIcon(lib.icon) }
  const openEditRoot = (id: string, label: string) => { setEditRootId(id); setEditRootLabel(label) }

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {/* App */}
      <section>
        <h2 className="text-lg font-medium mb-3">Application</h2>
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <p className="text-xs text-muted-foreground">App name</p>
            <p className="font-medium text-sm">{config?.app_name}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => { setEditAppName(config?.app_name ?? ''); setEditAppNameOpen(true) }}>
            <Pencil size={14} />
          </Button>
        </div>
      </section>

      {/* Storage Roots */}
      <section>
        <h2 className="text-lg font-medium mb-3">Storage Roots</h2>
        <div className="space-y-2 mb-4">
          {config?.roots.map(r => (
            <div key={r.id} className="flex items-center justify-between p-3 border rounded-lg">
              {editRootId === r.id ? (
                <div className="flex flex-1 gap-2 mr-2">
                  <Input value={editRootLabel} onChange={e => setEditRootLabel(e.target.value)} className="h-7 text-sm"
                    onKeyDown={e => e.key === 'Enter' && updateRoot.mutate()} autoFocus />
                  <Button size="sm" onClick={() => updateRoot.mutate()} disabled={updateRoot.isPending}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditRootId(null)}>Cancel</Button>
                </div>
              ) : (
                <>
                  <div>
                    <p className="font-medium text-sm">{r.label}</p>
                    <p className="text-xs text-muted-foreground">{r.path}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditRoot(r.id, r.label)}>
                      <Pencil size={13} />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteRoot.mutate(r.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input placeholder="Path (e.g. /data/videos)" value={newPath} onChange={e => setNewPath(e.target.value)} />
          <Input placeholder="Label" value={newLabel} onChange={e => setNewLabel(e.target.value)} className="w-32" />
          <Button onClick={() => addRoot.mutate()} disabled={!newPath || !newLabel}>
            <Plus size={14} className="mr-1" />Add
          </Button>
        </div>
      </section>

      {/* Index */}
      <section>
        <h2 className="text-lg font-medium mb-3">Index</h2>
        <Button onClick={() => startScan.mutate()} variant="outline" disabled={startScan.isPending}>
          <RefreshCw size={14} className="mr-2" />Full Rescan
        </Button>
        {scanJob && (
          <p className="mt-2 text-sm text-muted-foreground">
            Status: {scanJob.status} — {scanJob.scanned} scanned, {scanJob.added} added
          </p>
        )}
      </section>

      {/* Danger zone */}
      <section>
        <h2 className="text-lg font-medium mb-3 text-destructive">Danger Zone</h2>
        <div className="flex items-center justify-between p-3 border border-destructive/30 rounded-lg">
          <div>
            <p className="font-medium text-sm">Reset Database</p>
            <p className="text-xs text-muted-foreground">Wipe all entries, libraries, categories, tags, collections, and favorites. Storage roots are preserved. A full rescan will run automatically.</p>
          </div>
          <Button variant="destructive" size="sm" onClick={() => setResetOpen(true)}>
            <AlertTriangle size={14} className="mr-1.5" />Reset
          </Button>
        </div>
      </section>

      {/* Libraries */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Libraries</h2>
          <Button size="sm" variant="outline" onClick={() => setNewLibOpen(true)}>
            <Plus size={14} className="mr-1" />New Library
          </Button>
        </div>
        <div className="space-y-2">
          {libraries.map(lib => (
            <div key={lib.id} className="flex items-center justify-between p-3 border rounded-lg">
              <p className="font-medium text-sm">{lib.icon} {lib.name}</p>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEditLib(lib)}>
                  <Pencil size={13} />
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteLib(lib)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* App name dialog */}
      <Dialog open={editAppNameOpen} onOpenChange={o => !o && setEditAppNameOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit App Name</DialogTitle></DialogHeader>
          <Input value={editAppName} onChange={e => setEditAppName(e.target.value)} autoFocus
            onKeyDown={e => e.key === 'Enter' && editAppName && updateAppName.mutate()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAppNameOpen(false)}>Cancel</Button>
            <Button onClick={() => updateAppName.mutate()} disabled={!editAppName || updateAppName.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New library dialog */}
      <Dialog open={newLibOpen} onOpenChange={o => !o && setNewLibOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Library</DialogTitle></DialogHeader>
          <div className="flex gap-2">
            <Input placeholder="Icon (emoji)" value={newLibIcon} onChange={e => setNewLibIcon(e.target.value)} className="w-20" />
            <Input placeholder="Library name" value={newLibName} onChange={e => setNewLibName(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewLibOpen(false)}>Cancel</Button>
            <Button onClick={() => createLib.mutate()} disabled={!newLibName || createLib.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit library dialog */}
      <Dialog open={!!editLib} onOpenChange={o => !o && setEditLib(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Library</DialogTitle></DialogHeader>
          <div className="flex gap-2">
            <Input value={editLibIcon} onChange={e => setEditLibIcon(e.target.value)} className="w-20" />
            <Input value={editLibName} onChange={e => setEditLibName(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLib(null)}>Cancel</Button>
            <Button onClick={() => updateLib.mutate()} disabled={!editLibName || updateLib.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete library dialog */}
      <Dialog open={!!deleteLib} onOpenChange={o => !o && setDeleteLib(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete "{deleteLib?.name}"?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">All categories in this library will be deleted. Files on disk are not affected.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteLib(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => delLib.mutate()} disabled={delLib.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset DB dialog */}
      <Dialog open={resetOpen} onOpenChange={o => !o && setResetOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset Database?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete all indexed entries, libraries, categories, tags, collections, and favorites.
            Storage roots and files on disk are not affected. A full rescan will start automatically.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => resetDB.mutate()} disabled={resetDB.isPending}>
              {resetDB.isPending ? 'Resetting…' : 'Reset & Rescan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
