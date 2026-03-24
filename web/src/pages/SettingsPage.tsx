// web/src/pages/SettingsPage.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Library } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useState } from 'react'
import { Trash2, Plus, RefreshCw, Pencil, AlertTriangle, Loader2, HardDrive, BookOpen, Settings2, RotateCcw } from 'lucide-react'
import { ErrorState, LoadingState } from '@/components/ui/state'

export function SettingsPage() {
  const qc = useQueryClient()
  const configQuery = useQuery({ queryKey: ['config'], queryFn: api.config.get })
  const librariesQuery = useQuery({ queryKey: ['libraries'], queryFn: api.libraries.list })
  const config = configQuery.data
  const libraries = librariesQuery.data ?? []

  // Roots
  const [newPath, setNewPath] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [editRootId, setEditRootId] = useState<string | null>(null)
  const [editRootLabel, setEditRootLabel] = useState('')
  const [deleteRootTarget, setDeleteRootTarget] = useState<{ id: string; label: string } | null>(null)

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
  const [resetConfirm, setResetConfirm] = useState('')

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
      setDeleteRootTarget(null)
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
    mutationFn: () => api.reset(),
    onSuccess: () => {
      qc.invalidateQueries()
      setResetOpen(false)
      setResetConfirm('')
    },
  })

  const openEditLib = (lib: Library) => { setEditLib(lib); setEditLibName(lib.name); setEditLibIcon(lib.icon) }
  const openEditRoot = (id: string, label: string) => { setEditRootId(id); setEditRootLabel(label) }

  if (configQuery.isPending || librariesQuery.isPending) {
    return <LoadingState title="Loading settings" description="Preparing app configuration, roots, and libraries." />
  }

  if (configQuery.error || librariesQuery.error) {
    return (
      <ErrorState
        title="Couldn't load settings"
        error={configQuery.error ?? librariesQuery.error}
        onRetry={() => {
          void configQuery.refetch()
          void librariesQuery.refetch()
        }}
      />
    )
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your application configuration</p>
      </div>

      {/* App */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Settings2 size={15} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Application</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 border rounded-xl bg-card">
          <div>
            <p className="text-xs text-muted-foreground">App name</p>
            <p className="font-medium text-sm mt-0.5">{config?.app_name}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditAppName(config?.app_name ?? ''); setEditAppNameOpen(true) }}>
            <Pencil size={14} />
          </Button>
        </div>
      </section>

      {/* Storage Roots */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <HardDrive size={15} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Storage Roots</h2>
        </div>
        <div className="space-y-2">
          {config?.roots.map(r => (
            <div key={r.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 border rounded-xl bg-card">
              {editRootId === r.id ? (
                <div className="flex flex-1 flex-col sm:flex-row gap-2 mr-2">
                  <Input value={editRootLabel} onChange={e => setEditRootLabel(e.target.value)} className="h-8 text-sm"
                    onKeyDown={e => e.key === 'Enter' && updateRoot.mutate()} autoFocus />
                  <Button size="sm" onClick={() => updateRoot.mutate()} disabled={updateRoot.isPending}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditRootId(null)}>Cancel</Button>
                </div>
              ) : (
                <>
                  <div>
                    <p className="font-medium text-sm">{r.label}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{r.path}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditRoot(r.id, r.label)}>
                      <Pencil size={13} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteRootTarget({ id: r.id, label: r.label })}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input placeholder="Path (e.g. /data/videos)" value={newPath} onChange={e => setNewPath(e.target.value)} />
          <Input placeholder="Label" value={newLabel} onChange={e => setNewLabel(e.target.value)} className="sm:w-32" />
          <Button onClick={() => addRoot.mutate()} disabled={!newPath || !newLabel || addRoot.isPending} className="gap-1.5 self-start">
            <Plus size={14} />Add
          </Button>
        </div>
      </section>

      {/* Index */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <RefreshCw size={15} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Index</h2>
        </div>
        <div className="p-4 border rounded-xl bg-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-sm">Full Rescan</p>
              <p className="text-xs text-muted-foreground mt-0.5">Re-index all storage roots</p>
            </div>
            <Button onClick={() => startScan.mutate()} variant="outline" size="sm" disabled={startScan.isPending} className="self-start">
              {startScan.isPending
                ? <Loader2 size={14} className="mr-1.5 animate-spin" />
                : <RefreshCw size={14} className="mr-1.5" />
              }
              Scan
            </Button>
          </div>
          {scanJob && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center gap-2">
                {scanJob.status === 'running' && <Loader2 size={13} className="animate-spin text-primary" />}
                <p className="text-sm text-muted-foreground">
                  {scanJob.status === 'running' ? 'Scanning' : scanJob.status === 'done' ? 'Complete' : 'Error'}
                  {' — '}{scanJob.scanned} scanned, {scanJob.added} added
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Libraries */}
      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={15} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Libraries</h2>
          </div>
          <Button size="sm" variant="outline" onClick={() => setNewLibOpen(true)} className="gap-1.5 self-start">
            <Plus size={14} />New Library
          </Button>
        </div>
        <div className="space-y-2">
          {libraries.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">No libraries yet</p>
          )}
          {libraries.map(lib => (
            <div key={lib.id} className="flex items-center justify-between gap-3 p-4 border rounded-xl bg-card">
              <p className="font-medium text-sm">{lib.icon} {lib.name}</p>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditLib(lib)}>
                  <Pencil size={13} />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteLib(lib)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Danger Zone */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={15} className="text-destructive" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-destructive">Danger Zone</h2>
        </div>
        <div className="p-4 border border-destructive/30 rounded-xl bg-destructive/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Reset Database</p>
              <p className="text-xs text-muted-foreground mt-0.5">Delete all metadata, categories, tags, and collections. Files on disk are not affected.</p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => { setResetConfirm(''); setResetOpen(true) }} className="gap-1.5">
              <RotateCcw size={14} />Reset
            </Button>
          </div>
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

      {/* Delete root dialog */}
      <Dialog open={!!deleteRootTarget} onOpenChange={o => !o && setDeleteRootTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remove "{deleteRootTarget?.label}"?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            The storage root will be removed from the app configuration. Files on disk are not deleted.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRootTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteRootTarget && deleteRoot.mutate(deleteRootTarget.id)}
              disabled={deleteRoot.isPending}
            >
              Remove Root
            </Button>
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

      {/* Reset DB confirmation dialog */}
      <Dialog open={resetOpen} onOpenChange={o => !o && setResetOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset Database?</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This will permanently delete all metadata including entries, categories, tags, collections, favorites, and saved views.
              Files on disk will not be affected.
            </p>
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-xs font-medium text-destructive">Type "reset" to confirm</p>
              <Input
                value={resetConfirm}
                onChange={e => setResetConfirm(e.target.value)}
                placeholder="reset"
                className="mt-2 h-8 text-sm"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => resetDB.mutate()}
              disabled={resetConfirm !== 'reset' || resetDB.isPending}
            >
              {resetDB.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              Reset Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
