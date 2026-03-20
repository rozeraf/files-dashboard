// web/src/pages/SearchPage.tsx
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { EntryGrid } from '@/components/ui/EntryGrid'
import { EntryTable } from '@/components/ui/EntryTable'
import { EntryDetailPanel } from '@/components/ui/EntryDetailPanel'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { LayoutGrid, List } from 'lucide-react'

export function SearchPage() {
  const [searchParams] = useSearchParams()
  const [view, setView] = useState<'grid' | 'table'>('grid')
  const [detailId, setDetailId] = useState<string | null>(null)

  const params = Object.fromEntries(searchParams.entries())

  const { data = [], isLoading } = useQuery({
    queryKey: ['search', params],
    queryFn: () => api.search(params),
    enabled: Object.keys(params).length > 0,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Search {params.q && <span className="text-muted-foreground font-normal">"{params.q}"</span>}
        </h1>
        <div className="flex gap-1">
          <Button variant={view === 'grid' ? 'default' : 'ghost'} size="icon" onClick={() => setView('grid')}><LayoutGrid size={16} /></Button>
          <Button variant={view === 'table' ? 'default' : 'ghost'} size="icon" onClick={() => setView('table')}><List size={16} /></Button>
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground">Searching…</p>}
      {!isLoading && data.length === 0 && <p className="text-muted-foreground">No results.</p>}

      {view === 'grid'
        ? <EntryGrid entries={data} onSelect={e => setDetailId(e.id)} />
        : <EntryTable entries={data} onSelect={e => setDetailId(e.id)} />
      }

      <EntryDetailPanel entryId={detailId} onClose={() => setDetailId(null)} />
    </div>
  )
}
