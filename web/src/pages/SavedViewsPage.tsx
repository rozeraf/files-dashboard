// web/src/pages/SavedViewsPage.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'

export function SavedViewsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data = [] } = useQuery({ queryKey: ['saved-views'], queryFn: api.savedViews.list })

  const del = useMutation({
    mutationFn: (id: string) => api.savedViews.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-views'] }),
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Saved Views</h1>
      <div className="space-y-2">
        {data.map(v => {
          const filters = JSON.parse(v.filters || '{}')
          const qs = new URLSearchParams(filters).toString()
          return (
            <div key={v.id} className="flex items-center group">
              <button onClick={() => navigate(`/search?${qs}`)}
                className="flex-1 p-3 rounded-lg border bg-card hover:border-primary/50 text-left transition-all">
                <p className="font-medium">{v.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{qs || 'No filters'}</p>
              </button>
              <Button
                variant="ghost" size="icon"
                className="ml-1 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                onClick={() => del.mutate(v.id)}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          )
        })}
        {data.length === 0 && <p className="text-sm text-muted-foreground">No saved views yet. Save searches from the Search page.</p>}
      </div>
    </div>
  )
}
