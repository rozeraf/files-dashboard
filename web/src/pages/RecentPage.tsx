// web/src/pages/RecentPage.tsx
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { EntryGrid } from '@/components/ui/EntryGrid'
import { EntryTable } from '@/components/ui/EntryTable'
import { EntryDetailPanel } from '@/components/ui/EntryDetailPanel'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { LayoutGrid, List } from 'lucide-react'

export function RecentPage() {
  const qc = useQueryClient()
  const [detailId, setDetailId] = useState<string | null>(null)
  const [view, setView] = useState<'grid' | 'table'>('grid')
  const { data = [] } = useQuery({ queryKey: ['recent', 'all'], queryFn: () => api.recent() })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['recent'] })
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recent</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Recently modified files</p>
        </div>
        <div className="flex gap-1">
          <Button variant={view === 'grid' ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setView('grid')}><LayoutGrid size={15} /></Button>
          <Button variant={view === 'table' ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setView('table')}><List size={15} /></Button>
        </div>
      </div>
      {view === 'grid'
        ? <EntryGrid entries={data} onSelect={e => setDetailId(e.id)} />
        : <EntryTable entries={data} onSelect={e => setDetailId(e.id)} />
      }
      <EntryDetailPanel entryId={detailId} onClose={() => setDetailId(null)}
        onDeleted={() => { setDetailId(null); invalidate() }} onRenamed={invalidate} />
    </div>
  )
}
