// web/src/components/ui/EntryTable.tsx
import { useState } from 'react'
import { Entry } from '@/lib/api'
import { formatSize, formatDate, mimeToIcon } from '@/lib/utils'
import { useUI } from '@/stores/ui'
import { cn } from '@/lib/utils'
import { Lightbox } from './Lightbox'

interface Props {
  entries: Entry[]
  lightboxEntries?: Entry[]
  onSelect?: (entry: Entry) => void
}

export function EntryTable({ entries, lightboxEntries, onSelect }: Props) {
  const { selectedIds, selectEntry } = useUI()
  const [lightboxId, setLightboxId] = useState<string | null>(null)

  const mediaEntries = (lightboxEntries ?? entries).filter(
    e => e.mime?.startsWith('image/') || e.mime?.startsWith('video/')
  )

  const handleClick = (e: React.MouseEvent, entry: Entry) => {
    if (e.shiftKey || e.metaKey) { selectEntry(entry.id, true); return }
    if (entry.mime?.startsWith('image/') || entry.mime?.startsWith('video/')) { setLightboxId(entry.id) }
    else { onSelect?.(entry) }
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-sm">No files here yet</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2 sm:hidden">
        {entries.map(entry => (
          <button
            key={entry.id}
            data-testid="entry-table-item"
            onClick={e => handleClick(e, entry)}
            onContextMenu={e => { e.preventDefault(); selectEntry(entry.id, true) }}
            className={cn(
              'w-full rounded-xl border bg-card px-3 py-3 text-left transition-colors',
              selectedIds.has(entry.id) ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'hover:bg-muted/30'
            )}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-base shrink-0">{entry.kind === 'dir' ? '📁' : mimeToIcon(entry.mime, entry.kind)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{entry.name}</p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="tabular-nums">{formatSize(entry.size)}</span>
                  <span>{formatDate(entry.mtime)}</span>
                  <span className="font-mono">{entry.ext || entry.kind}</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="hidden rounded-xl border overflow-hidden sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-left text-muted-foreground">
              <th className="px-3 sm:px-4 py-2.5 font-medium text-xs uppercase tracking-wider">Name</th>
              <th className="px-3 sm:px-4 py-2.5 font-medium text-xs uppercase tracking-wider hidden xs:table-cell">Size</th>
              <th className="px-3 sm:px-4 py-2.5 font-medium text-xs uppercase tracking-wider hidden md:table-cell">Modified</th>
              <th className="px-3 sm:px-4 py-2.5 font-medium text-xs uppercase tracking-wider hidden lg:table-cell">Type</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(entry => (
              <tr
                key={entry.id}
                data-testid="entry-table-item"
                onClick={e => handleClick(e, entry)}
                className={cn(
                  'border-t cursor-pointer transition-colors duration-100',
                  selectedIds.has(entry.id) ? 'bg-primary/5' : 'hover:bg-muted/30'
                )}
              >
                <td className="px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-2.5">
                  <span className="text-base shrink-0">{entry.kind === 'dir' ? '📁' : mimeToIcon(entry.mime, entry.kind)}</span>
                  <span className="truncate font-medium text-xs sm:text-sm">{entry.name}</span>
                </td>
                <td className="px-3 sm:px-4 py-2.5 text-muted-foreground tabular-nums hidden xs:table-cell">{formatSize(entry.size)}</td>
                <td className="px-3 sm:px-4 py-2.5 text-muted-foreground hidden md:table-cell">{formatDate(entry.mtime)}</td>
                <td className="px-3 sm:px-4 py-2.5 text-muted-foreground font-mono text-xs hidden lg:table-cell">{entry.ext || entry.kind}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {lightboxId && (
        <Lightbox
          entries={mediaEntries}
          activeId={lightboxId}
          onClose={() => setLightboxId(null)}
        />
      )}
    </>
  )
}
