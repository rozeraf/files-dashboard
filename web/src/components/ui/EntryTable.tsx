// web/src/components/ui/EntryTable.tsx
import { useState } from 'react'
import { Entry } from '@/lib/api'
import { formatSize, formatDate, mimeToIcon } from '@/lib/utils'
import { useUI } from '@/stores/ui'
import { cn } from '@/lib/utils'
import { Lightbox } from './Lightbox'

interface Props {
  entries: Entry[]
  onSelect?: (entry: Entry) => void
}

export function EntryTable({ entries, onSelect }: Props) {
  const { selectedIds, selectEntry } = useUI()
  const [lightboxId, setLightboxId] = useState<string | null>(null)

  const imageEntries = entries.filter(e => e.mime?.startsWith('image/'))

  const handleClick = (e: React.MouseEvent, entry: Entry) => {
    if (e.shiftKey || e.metaKey) { selectEntry(entry.id, true); return }
    if (entry.mime?.startsWith('image/')) { setLightboxId(entry.id) }
    else { onSelect?.(entry) }
  }

  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 font-medium">Name</th>
            <th className="pb-2 font-medium">Size</th>
            <th className="pb-2 font-medium">Modified</th>
            <th className="pb-2 font-medium">Type</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(entry => (
            <tr
              key={entry.id}
              onClick={e => handleClick(e, entry)}
              className={cn(
                'border-b cursor-pointer hover:bg-muted/50 transition-colors',
                selectedIds.has(entry.id) && 'bg-primary/5'
              )}
            >
              <td className="py-2 flex items-center gap-2">
                <span>{entry.kind === 'dir' ? '📁' : mimeToIcon(entry.mime, entry.kind)}</span>
                <span className="truncate max-w-xs">{entry.name}</span>
              </td>
              <td className="py-2 text-muted-foreground">{formatSize(entry.size)}</td>
              <td className="py-2 text-muted-foreground">{formatDate(entry.mtime)}</td>
              <td className="py-2 text-muted-foreground">{entry.ext || entry.kind}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {lightboxId && (
        <Lightbox
          entries={imageEntries}
          activeId={lightboxId}
          onClose={() => setLightboxId(null)}
        />
      )}
    </>
  )
}
