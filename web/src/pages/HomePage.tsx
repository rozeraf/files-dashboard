// web/src/pages/HomePage.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useNavigate } from 'react-router-dom'
import { EntryGrid } from '@/components/ui/EntryGrid'
import { EntryDetailPanel } from '@/components/ui/EntryDetailPanel'
import { useState } from 'react'
import { RefreshCw, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state'

export function HomePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [detailId, setDetailId] = useState<string | null>(null)

  const librariesQuery = useQuery({ queryKey: ['libraries'], queryFn: api.libraries.list })
  const recentQuery = useQuery({ queryKey: ['recent', 'preview'], queryFn: () => api.recent(12) })
  const recentAllQuery = useQuery({ queryKey: ['recent', 'all'], queryFn: () => api.recent() })
  const favoritesQuery = useQuery({ queryKey: ['favorites', 'preview'], queryFn: () => api.favorites.list(12) })
  const favoritesAllQuery = useQuery({ queryKey: ['favorites', 'all'], queryFn: () => api.favorites.list() })

  const libraries = librariesQuery.data ?? []
  const recent = recentQuery.data ?? []
  const recentAll = recentAllQuery.data
  const favorites = favoritesQuery.data ?? []
  const favoritesAll = favoritesAllQuery.data
  const homeError = librariesQuery.error ?? recentQuery.error ?? favoritesQuery.error

  const scan = useMutation({
    mutationFn: api.scan.start,
    onSuccess: () => qc.invalidateQueries(),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['recent'] })
    qc.invalidateQueries({ queryKey: ['favorites'] })
  }

  if (librariesQuery.isPending || recentQuery.isPending || favoritesQuery.isPending) {
    return (
      <LoadingState
        title="Loading dashboard"
        description="Preparing your libraries, recent files, and favorites."
      />
    )
  }

  if (homeError) {
    return (
      <ErrorState
        title="Couldn't load the dashboard"
        error={homeError}
        onRetry={() => {
          void librariesQuery.refetch()
          void recentQuery.refetch()
          void favoritesQuery.refetch()
        }}
      />
    )
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your files at a glance</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => scan.mutate()}
          disabled={scan.isPending}
          className="gap-2"
        >
          {scan.isPending
            ? <Loader2 size={14} className="animate-spin" />
            : <RefreshCw size={14} />
          }
          {scan.isPending ? 'Scanning...' : 'Rescan'}
        </Button>
      </div>

      {/* Libraries */}
      {libraries && libraries.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Libraries</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
            {libraries.map(lib => (
              <button
                key={lib.id}
                onClick={() => navigate(`/libraries/${lib.id}`)}
                className="group p-4 rounded-xl border bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 text-left"
              >
                <div className="text-2xl mb-2 group-hover:scale-110 transition-transform duration-200">{lib.icon}</div>
                <p className="font-medium text-sm">{lib.name}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Recent */}
      {recent && recent.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent</h2>
            <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" onClick={() => navigate('/recent')}>
              View all<ArrowRight size={12} />
            </Button>
          </div>
          <EntryGrid entries={recent} lightboxEntries={recentAll ?? recent} onSelect={e => setDetailId(e.id)} />
        </section>
      )}

      {/* Favorites */}
      {favorites && favorites.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Favorites</h2>
            <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" onClick={() => navigate('/favorites')}>
              View all<ArrowRight size={12} />
            </Button>
          </div>
          <EntryGrid entries={favorites} lightboxEntries={favoritesAll ?? favorites} onSelect={e => setDetailId(e.id)} />
        </section>
      )}

      {/* Empty state */}
      {!libraries.length && !recent.length && (
        <EmptyState
          title="No files indexed yet"
          description="Add a storage root in Settings, then run a scan to populate the dashboard."
          action={
            <Button variant="outline" onClick={() => navigate('/settings')}>
              Go to Settings
            </Button>
          }
        />
      )}

      <EntryDetailPanel entryId={detailId} onClose={() => setDetailId(null)}
        onDeleted={() => { setDetailId(null); invalidate() }} onRenamed={invalidate} />
    </div>
  )
}
