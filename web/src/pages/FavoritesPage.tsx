// web/src/pages/FavoritesPage.tsx
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { EntryGrid } from '@/components/ui/EntryGrid'
import { EntryDetailPanel } from '@/components/ui/EntryDetailPanel'
import { useState } from 'react'
import { Heart } from 'lucide-react'

export function FavoritesPage() {
  const qc = useQueryClient()
  const [detailId, setDetailId] = useState<string | null>(null)
  const { data = [] } = useQuery({ queryKey: ['favorites'], queryFn: () => api.favorites.list(50) })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['favorites'] })
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Favorites</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{data.length} {data.length === 1 ? 'item' : 'items'}</p>
      </div>
      {data.length === 0 ? (
        <div className="text-center py-20">
          <Heart size={32} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No favorites yet</p>
          <p className="text-xs text-muted-foreground mt-1">Click the heart icon on any file to add it here</p>
        </div>
      ) : (
        <EntryGrid entries={data} onSelect={e => setDetailId(e.id)} />
      )}
      <EntryDetailPanel entryId={detailId} onClose={() => setDetailId(null)}
        onDeleted={() => { setDetailId(null); invalidate() }} onRenamed={invalidate} />
    </div>
  )
}
