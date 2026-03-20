// web/src/pages/TagsPage.tsx
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'

export function TagsPage() {
  const navigate = useNavigate()
  const { data = [] } = useQuery({ queryKey: ['tags'], queryFn: api.tags.list })
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Tags</h1>
      <div className="flex flex-wrap gap-2">
        {data.map(tag => (
          <button key={tag.id} onClick={() => navigate(`/search?tags=${tag.id}`)}>
            <Badge style={{ backgroundColor: tag.color || undefined }} className="cursor-pointer text-sm px-3 py-1">
              {tag.name}
            </Badge>
          </button>
        ))}
      </div>
    </div>
  )
}
