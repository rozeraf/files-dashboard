// web/src/pages/CollectionDetailPage.tsx
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { EntryGrid } from '@/components/ui/EntryGrid'
import { EntryDetailPanel } from '@/components/ui/EntryDetailPanel'
import { useState } from 'react'

export function CollectionDetailPage() {
  const { collectionId } = useParams<{ collectionId: string }>()
  const [detailId, setDetailId] = useState<string | null>(null)
  const { data: col } = useQuery({ queryKey: ['collection', collectionId], queryFn: () => api.collections.get(collectionId!) })
  const { data } = useQuery({ queryKey: ['collection-entries', collectionId], queryFn: () => api.collections.entries(collectionId!) })
  const entries = data?.items ?? []
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{col?.name}</h1>
      {col?.description && <p className="text-muted-foreground">{col.description}</p>}
      <EntryGrid entries={entries} onSelect={e => setDetailId(e.id)} />
      <EntryDetailPanel entryId={detailId} onClose={() => setDetailId(null)} />
    </div>
  )
}
