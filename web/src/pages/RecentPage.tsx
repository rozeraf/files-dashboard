// web/src/pages/RecentPage.tsx
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { EntryGrid } from '@/components/ui/EntryGrid'
import { EntryDetailPanel } from '@/components/ui/EntryDetailPanel'
import { useState } from 'react'

export function RecentPage() {
  const [detailId, setDetailId] = useState<string | null>(null)
  const { data = [] } = useQuery({ queryKey: ['recent'], queryFn: () => api.recent(50) })
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Recent</h1>
      <EntryGrid entries={data} onSelect={e => setDetailId(e.id)} />
      <EntryDetailPanel entryId={detailId} onClose={() => setDetailId(null)} />
    </div>
  )
}
