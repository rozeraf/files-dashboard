// web/src/pages/CategoryPage.tsx
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState } from 'react'
import { EntryGrid } from '@/components/ui/EntryGrid'
import { EntryTable } from '@/components/ui/EntryTable'
import { EntryDetailPanel } from '@/components/ui/EntryDetailPanel'
import { Button } from '@/components/ui/button'
import { LayoutGrid, List } from 'lucide-react'

export function CategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const [view, setView] = useState<'grid' | 'table'>('grid')
  const [detailId, setDetailId] = useState<string | null>(null)

  const { data } = useQuery({
    queryKey: ['category-entries', categoryId],
    queryFn: () => api.categories.entries(categoryId!),
  })

  const entries = data?.items ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Category</h1>
        <div className="flex gap-1">
          <Button variant={view === 'grid' ? 'default' : 'ghost'} size="icon" onClick={() => setView('grid')}><LayoutGrid size={16} /></Button>
          <Button variant={view === 'table' ? 'default' : 'ghost'} size="icon" onClick={() => setView('table')}><List size={16} /></Button>
        </div>
      </div>

      {view === 'grid'
        ? <EntryGrid entries={entries} onSelect={e => setDetailId(e.id)} />
        : <EntryTable entries={entries} onSelect={e => setDetailId(e.id)} />
      }

      <EntryDetailPanel entryId={detailId} onClose={() => setDetailId(null)} />
    </div>
  )
}
