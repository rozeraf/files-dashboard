// web/src/pages/FilesPage.tsx
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState } from 'react'
import { EntryTable } from '@/components/ui/EntryTable'
import { EntryDetailPanel } from '@/components/ui/EntryDetailPanel'
import { Button } from '@/components/ui/button'
import { ChevronRight } from 'lucide-react'

export function FilesPage() {
  const [rootId, setRootId] = useState<string | null>(null)
  const [path, setPath] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const _qc = useQueryClient()

  const { data: roots = [] } = useQuery({ queryKey: ['roots'], queryFn: api.roots.list })
  const { data: entries = [] } = useQuery({
    queryKey: ['fs-entries', rootId, path],
    queryFn: () => api.fs.list(rootId!, path),
    enabled: !!rootId,
  })

  const navigateDir = (dir: string) => setPath(dir)
  const up = () => setPath(path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '')
  void up

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Files</h1>

      <div className="flex gap-2 flex-wrap">
        {roots.map(r => (
          <Button key={r.id} variant={rootId === r.id ? 'default' : 'outline'} size="sm"
            onClick={() => { setRootId(r.id); setPath('') }}>
            {r.label}
          </Button>
        ))}
      </div>

      {rootId && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <button onClick={() => setPath('')} className="hover:text-foreground">root</button>
          {path.split('/').filter(Boolean).map((seg, i, arr) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight size={12} />
              <button
                onClick={() => setPath(arr.slice(0, i + 1).join('/'))}
                className="hover:text-foreground"
              >{seg}</button>
            </span>
          ))}
        </div>
      )}

      {rootId && (
        <EntryTable
          entries={entries}
          onSelect={e => {
            if (e.kind === 'dir') navigateDir(e.rel_path)
            else setDetailId(e.id)
          }}
        />
      )}

      <EntryDetailPanel entryId={detailId} onClose={() => setDetailId(null)} />
    </div>
  )
}
