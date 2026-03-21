// web/src/pages/CollectionDetailPage.tsx
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Entry } from '@/lib/api'
import { EntryDetailPanel } from '@/components/ui/EntryDetailPanel'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { X } from 'lucide-react'
import { formatSize, formatDate, mimeToIcon } from '@/lib/utils'

export function CollectionDetailPage() {
  const { collectionId } = useParams<{ collectionId: string }>()
  const qc = useQueryClient()
  const [detailId, setDetailId] = useState<string | null>(null)

  const { data: col } = useQuery({
    queryKey: ['collection', collectionId],
    queryFn: () => api.collections.get(collectionId!),
    enabled: !!collectionId,
  })
  const { data } = useQuery({
    queryKey: ['collection-entries', collectionId],
    queryFn: () => api.collections.entries(collectionId!),
    enabled: !!collectionId,
  })
  const entries: Entry[] = data?.items ?? []

  const remove = useMutation({
    mutationFn: (entryId: string) => api.collections.remove(collectionId!, entryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collection-entries', collectionId] }),
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{col?.name}</h1>
      {col?.description && <p className="text-muted-foreground">{col.description}</p>}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 font-medium">Name</th>
            <th className="pb-2 font-medium">Size</th>
            <th className="pb-2 font-medium">Modified</th>
            <th className="pb-2 font-medium w-10"></th>
          </tr>
        </thead>
        <tbody>
          {entries.map(entry => (
            <tr key={entry.id} className="border-b hover:bg-muted/50 transition-colors group">
              <td className="py-2 flex items-center gap-2 cursor-pointer"
                onClick={() => setDetailId(entry.id)}>
                <span>{mimeToIcon(entry.mime, entry.kind)}</span>
                <span className="truncate max-w-xs">{entry.name}</span>
              </td>
              <td className="py-2 text-muted-foreground">{formatSize(entry.size)}</td>
              <td className="py-2 text-muted-foreground">{formatDate(entry.mtime)}</td>
              <td className="py-2">
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                  title="Remove from collection"
                  onClick={e => { e.stopPropagation(); remove.mutate(entry.id) }}
                >
                  <X size={13} />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <EntryDetailPanel entryId={detailId} onClose={() => setDetailId(null)}
        onDeleted={() => { setDetailId(null); qc.invalidateQueries({ queryKey: ['collection-entries', collectionId] }) }}
        onRenamed={() => qc.invalidateQueries({ queryKey: ['collection-entries', collectionId] })} />
    </div>
  )
}
