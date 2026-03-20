// web/src/pages/CollectionsPage.tsx
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useNavigate } from 'react-router-dom'

export function CollectionsPage() {
  const navigate = useNavigate()
  const { data = [] } = useQuery({ queryKey: ['collections'], queryFn: api.collections.list })
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Collections</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {data.map(col => (
          <button key={col.id} onClick={() => navigate(`/collections/${col.id}`)}
            className="p-4 rounded-xl border bg-card hover:border-primary/50 hover:shadow-sm transition-all text-left">
            <p className="font-medium">{col.name}</p>
            {col.description && <p className="text-xs text-muted-foreground mt-1">{col.description}</p>}
          </button>
        ))}
      </div>
    </div>
  )
}
