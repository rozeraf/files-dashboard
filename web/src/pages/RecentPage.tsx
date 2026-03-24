// web/src/pages/RecentPage.tsx
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { EntryGrid } from '@/components/ui/EntryGrid'
import { EntryTable } from '@/components/ui/EntryTable'
import { EntryDetailPanel } from '@/components/ui/EntryDetailPanel'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { LayoutGrid, List } from 'lucide-react'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state'

export function RecentPage() {
  const qc = useQueryClient()
  const [detailId, setDetailId] = useState<string | null>(null)
  const [view, setView] = useState<'grid' | 'table'>('grid')
  const recentQuery = useQuery({ queryKey: ['recent', 'all'], queryFn: () => api.recent() })
  const data = recentQuery.data ?? []
  const invalidate = () => qc.invalidateQueries({ queryKey: ['recent'] })

  if (recentQuery.isPending) {
    return <LoadingState title="Loading recent files" description="Fetching the latest changes across your library." />
  }

  if (recentQuery.error) {
    return <ErrorState title="Couldn't load recent files" error={recentQuery.error} onRetry={() => void recentQuery.refetch()} />
  }

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
      {data.length === 0 ? (
        <EmptyState
          compact
          title="No recent files yet"
          description="Modified items will appear here after your first scan or after changes on disk."
        />
      ) : view === 'grid'
        ? <EntryGrid entries={data} onSelect={e => setDetailId(e.id)} />
        : <EntryTable entries={data} onSelect={e => setDetailId(e.id)} />
      }
      <EntryDetailPanel entryId={detailId} onClose={() => setDetailId(null)}
        onDeleted={() => { setDetailId(null); invalidate() }} onRenamed={invalidate} />
    </div>
  )
}
