// web/src/pages/FavoritesPage.tsx
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { EntryGrid } from '@/components/ui/EntryGrid'
import { EntryDetailPanel } from '@/components/ui/EntryDetailPanel'
import { useState } from 'react'
import { Heart } from 'lucide-react'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state'

export function FavoritesPage() {
  const qc = useQueryClient()
  const [detailId, setDetailId] = useState<string | null>(null)
  const favoritesQuery = useQuery({ queryKey: ['favorites', 'all'], queryFn: () => api.favorites.list() })
  const data = favoritesQuery.data ?? []
  const invalidate = () => qc.invalidateQueries({ queryKey: ['favorites'] })

  if (favoritesQuery.isPending) {
    return <LoadingState title="Loading favorites" description="Collecting the files you marked for quick access." />
  }

  if (favoritesQuery.error) {
    return <ErrorState title="Couldn't load favorites" error={favoritesQuery.error} onRetry={() => void favoritesQuery.refetch()} />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Favorites</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{data.length} {data.length === 1 ? 'item' : 'items'}</p>
      </div>
      {data.length === 0 ? (
        <EmptyState
          title="No favorites yet"
          description="Click the heart icon on any file to keep it handy here."
          icon={<Heart size={22} />}
        />
      ) : (
        <EntryGrid entries={data} onSelect={e => setDetailId(e.id)} />
      )}
      <EntryDetailPanel entryId={detailId} onClose={() => setDetailId(null)}
        onDeleted={() => { setDetailId(null); invalidate() }} onRenamed={invalidate} />
    </div>
  )
}
