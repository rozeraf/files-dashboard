// web/src/pages/SettingsPage.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import { Trash2, Plus, RefreshCw } from 'lucide-react'

export function SettingsPage() {
  const qc = useQueryClient()
  const { data: config } = useQuery({ queryKey: ['config'], queryFn: api.config.get })
  const [newPath, setNewPath] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [scanJobId, setScanJobId] = useState<string | null>(null)

  const addRoot = useMutation({
    mutationFn: () => api.roots.create({ path: newPath, label: newLabel }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['config'] })
      qc.invalidateQueries({ queryKey: ['roots'] })
      setNewPath('')
      setNewLabel('')
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

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section>
        <h2 className="text-lg font-medium mb-3">Storage Roots</h2>
        <div className="space-y-2 mb-4">
          {config?.roots.map(r => (
            <div key={r.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium text-sm">{r.label}</p>
                <p className="text-xs text-muted-foreground">{r.path}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteRoot.mutate(r.id)}>
                <Trash2 size={14} />
              </Button>
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

      <section>
        <h2 className="text-lg font-medium mb-3">Index</h2>
        <Button onClick={() => startScan.mutate()} variant="outline">
          <RefreshCw size={14} className="mr-2" />Full Rescan
        </Button>
        {scanJob && (
          <p className="mt-2 text-sm text-muted-foreground">
            Status: {scanJob.status} — {scanJob.scanned} scanned, {scanJob.added} added
          </p>
        )}
      </section>
    </div>
  )
}
