// web/src/components/ui/EntryGrid.tsx
import { useState } from 'react'
import { api, Entry } from '@/lib/api'
import { mimeToIcon, formatSize } from '@/lib/utils'
import { useUI } from '@/stores/ui'
import { cn } from '@/lib/utils'
import { Lightbox } from './Lightbox'
import { Play, Check } from 'lucide-react'

interface Props {
  entries: Entry[]
  onSelect?: (entry: Entry) => void
}

export function EntryGrid({ entries, onSelect }: Props) {
  const { selectedIds, selectEntry } = useUI()
  const [lightboxId, setLightboxId] = useState<string | null>(null)

  const mediaEntries = entries.filter(e => e.mime?.startsWith('image/') || e.mime?.startsWith('video/'))

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
      <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2 sm:gap-3">
        {entries.map(entry => {
          const isSelected = selectedIds.has(entry.id)
          const isImage = entry.mime?.startsWith('image/')
          const isVideo = entry.mime?.startsWith('video/')
          return (
            <div
              key={entry.id}
              onClick={e => handleClick(e, entry)}
              onContextMenu={e => { e.preventDefault(); selectEntry(entry.id, true) }}
              className={cn(
                'group relative rounded-xl border cursor-pointer overflow-hidden transition-all duration-200',
                'hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5',
                isSelected ? 'border-primary ring-2 ring-primary/30 shadow-md' : 'bg-card'
              )}
            >
              <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden relative">
                {isImage ? (
                  <img
                    src={api.fs.raw(entry.id)}
                    alt={entry.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : isVideo ? (
                  <>
                    <video
                      src={`${api.fs.raw(entry.id)}#t=0.1`}
                      className="w-full h-full object-cover"
                      preload="metadata"
                      muted
                      playsInline
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                      <div className="bg-black/60 backdrop-blur-sm rounded-full p-2.5 shadow-lg">
                        <Play size={20} className="fill-white text-white ml-0.5" />
                      </div>
                    </div>
                  </>
                ) : (
                  <span className="text-4xl opacity-60 group-hover:opacity-80 transition-opacity">{entry.kind === 'dir' ? '📁' : mimeToIcon(entry.mime, entry.kind)}</span>
                )}
              </div>
              <div className="p-2.5">
                <p className="text-xs font-medium truncate leading-tight" title={entry.name}>{entry.name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{formatSize(entry.size)}</p>
              </div>
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-md">
                  <Check size={12} className="text-primary-foreground" strokeWidth={3} />
                </div>
              )}
            </div>
          )
        })}
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
