// web/src/pages/HomePage.tsx
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useNavigate } from 'react-router-dom'
import { EntryGrid } from '@/components/ui/EntryGrid'
import { EntryDetailPanel } from '@/components/ui/EntryDetailPanel'
import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function HomePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [detailId, setDetailId] = useState<string | null>(null)

  const { data: libraries } = useQuery({ queryKey: ['libraries'], queryFn: api.libraries.list })
  const { data: recent } = useQuery({ queryKey: ['recent'], queryFn: () => api.recent(10) })
  const { data: favorites } = useQuery({ queryKey: ['favorites'], queryFn: () => api.favorites.list(10) })

  const startScan = () => api.scan.start().then(() => {})
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['recent'] })
    qc.invalidateQueries({ queryKey: ['favorites'] })
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Button variant="outline" size="sm" onClick={startScan}>
          <RefreshCw size={14} className="mr-2" />Rescan
        </Button>
      </div>

      <section>
        <h2 className="text-lg font-medium mb-3">Libraries</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {libraries?.map(lib => (
            <button
              key={lib.id}
              onClick={() => navigate(`/libraries/${lib.id}`)}
              className="p-4 rounded-xl border bg-card hover:border-primary/50 hover:shadow-sm transition-all text-left"
            >
              <div className="text-3xl mb-2">{lib.icon}</div>
              <p className="font-medium text-sm">{lib.name}</p>
            </button>
          ))}
        </div>
      </section>

      {recent && recent.length > 0 && (
        <section>
          <h2 className="text-lg font-medium mb-3">Recent</h2>
          <EntryGrid entries={recent} onSelect={e => setDetailId(e.id)} />
        </section>
      )}

      {favorites && favorites.length > 0 && (
        <section>
          <h2 className="text-lg font-medium mb-3">Favorites</h2>
          <EntryGrid entries={favorites} onSelect={e => setDetailId(e.id)} />
        </section>
      )}

      <EntryDetailPanel entryId={detailId} onClose={() => setDetailId(null)}
        onDeleted={() => { setDetailId(null); invalidate() }} onRenamed={invalidate} />
    </div>
  )
}
