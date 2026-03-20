// web/src/pages/UncategorizedPage.tsx
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { EntryGrid } from '@/components/ui/EntryGrid'
import { EntryDetailPanel } from '@/components/ui/EntryDetailPanel'
import { useState } from 'react'

export function UncategorizedPage() {
  const [detailId, setDetailId] = useState<string | null>(null)
  const { data } = useQuery({ queryKey: ['uncategorized'], queryFn: () => api.uncategorized() })
  const entries = data?.items ?? []
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Uncategorized</h1>
        <span className="text-sm text-muted-foreground">{data?.total ?? 0} items</span>
      </div>
      <EntryGrid entries={entries} onSelect={e => setDetailId(e.id)} />
      <EntryDetailPanel entryId={detailId} onClose={() => setDetailId(null)} />
    </div>
  )
}
