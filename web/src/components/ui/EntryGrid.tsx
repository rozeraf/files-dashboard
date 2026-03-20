// web/src/components/ui/EntryGrid.tsx
import { api, Entry } from '@/lib/api'
import { mimeToIcon, formatSize } from '@/lib/utils'
import { useUI } from '@/stores/ui'
import { cn } from '@/lib/utils'

interface Props {
  entries: Entry[]
  onSelect?: (entry: Entry) => void
}

export function EntryGrid({ entries, onSelect }: Props) {
  const { selectedIds, selectEntry } = useUI()

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
      {entries.map(entry => {
        const isSelected = selectedIds.has(entry.id)
        const isImage = entry.mime.startsWith('image/')
        return (
          <div
            key={entry.id}
            onClick={(e) => { e.shiftKey || e.metaKey ? selectEntry(entry.id, true) : onSelect?.(entry) }}
            onContextMenu={(e) => { e.preventDefault(); selectEntry(entry.id, true) }}
            className={cn(
              'group relative rounded-lg border cursor-pointer transition-all overflow-hidden',
              'hover:border-primary/50 hover:shadow-md',
              isSelected && 'border-primary ring-2 ring-primary/30'
            )}
          >
            <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
              {isImage ? (
                <img
                  src={api.fs.raw(entry.id)}
                  alt={entry.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="text-4xl">{entry.kind === 'dir' ? '📁' : mimeToIcon(entry.mime, entry.kind)}</span>
              )}
            </div>
            <div className="p-2">
              <p className="text-xs font-medium truncate" title={entry.name}>{entry.name}</p>
              <p className="text-xs text-muted-foreground">{formatSize(entry.size)}</p>
            </div>
            {isSelected && (
              <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                <span className="text-primary-foreground text-xs">✓</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
