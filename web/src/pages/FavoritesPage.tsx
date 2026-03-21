// web/src/pages/FavoritesPage.tsx
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { EntryGrid } from '@/components/ui/EntryGrid'
import { EntryDetailPanel } from '@/components/ui/EntryDetailPanel'
import { useState } from 'react'

export function FavoritesPage() {
  const qc = useQueryClient()
  const [detailId, setDetailId] = useState<string | null>(null)
  const { data = [] } = useQuery({ queryKey: ['favorites'], queryFn: () => api.favorites.list(50) })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['favorites'] })
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Favorites</h1>
      {data.length === 0 && <p className="text-muted-foreground">No favorites yet.</p>}
      <EntryGrid entries={data} onSelect={e => setDetailId(e.id)} />
      <EntryDetailPanel entryId={detailId} onClose={() => setDetailId(null)}
        onDeleted={() => { setDetailId(null); invalidate() }} onRenamed={invalidate} />
    </div>
  )
}
