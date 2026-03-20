// web/src/pages/SavedViewsPage.tsx
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useNavigate } from 'react-router-dom'

export function SavedViewsPage() {
  const navigate = useNavigate()
  const { data = [] } = useQuery({ queryKey: ['saved-views'], queryFn: api.savedViews.list })
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Saved Views</h1>
      <div className="space-y-2">
        {data.map(v => {
          const filters = JSON.parse(v.filters || '{}')
          const qs = new URLSearchParams(filters).toString()
          return (
            <button key={v.id} onClick={() => navigate(`/search?${qs}`)}
              className="w-full p-3 rounded-lg border bg-card hover:border-primary/50 text-left transition-all">
              <p className="font-medium">{v.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{qs || 'No filters'}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
