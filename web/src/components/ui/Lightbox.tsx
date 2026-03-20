// web/src/components/ui/Lightbox.tsx
import { useEffect, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { Entry, api } from '@/lib/api'
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'

interface Props {
  entries: Entry[]
  activeId: string
  onClose: () => void
}

export function Lightbox({ entries, activeId, onClose }: Props) {
  const [currentId, setCurrentId] = useState(activeId)
  const [zoom, setZoom] = useState(1)
  const [loaded, setLoaded] = useState(false)

  const idx = entries.findIndex(e => e.id === currentId)
  const entry = entries[idx]

  const go = useCallback((dir: -1 | 1) => {
    const next = idx + dir
    if (next >= 0 && next < entries.length) {
      setCurrentId(entries[next].id)
      setZoom(1)
      setLoaded(false)
    }
  }, [idx, entries])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.5, 4))
      if (e.key === '-') setZoom(z => Math.max(z - 0.5, 0.5))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [go, onClose])

  // sync when parent changes activeId (e.g. opening fresh)
  useEffect(() => { setCurrentId(activeId); setZoom(1); setLoaded(false) }, [activeId])

  if (!entry) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/96 flex flex-col"
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" onClick={e => e.stopPropagation()}>
        <span className="text-white/50 text-sm font-mono">{idx + 1} / {entries.length}</span>
        <span className="text-white/80 text-sm truncate max-w-md text-center">{entry.name}</span>
        <div className="flex items-center gap-1">
          <button
            className="p-1.5 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            onClick={() => setZoom(z => Math.max(z - 0.5, 0.5))}
            title="Zoom out (−)"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-white/40 text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button
            className="p-1.5 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            onClick={() => setZoom(z => Math.min(z + 0.5, 4))}
            title="Zoom in (+)"
          >
            <ZoomIn size={18} />
          </button>
          <button
            className="ml-2 p-1.5 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            onClick={onClose}
            title="Close (Esc)"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Image area */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden min-h-0" onClick={onClose}>
        {/* Prev */}
        {idx > 0 && (
          <button
            className="absolute left-3 z-10 p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            onClick={e => { e.stopPropagation(); go(-1) }}
            title="Previous (←)"
          >
            <ChevronLeft size={36} />
          </button>
        )}

        {/* Image */}
        <div
          className="transition-transform duration-150 ease-out"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
          onClick={e => e.stopPropagation()}
        >
          {!loaded && (
            <div className="w-32 h-32 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
          <img
            key={currentId}
            src={api.fs.raw(currentId)}
            alt={entry.name}
            onLoad={() => setLoaded(true)}
            className="max-h-[calc(100vh-8rem)] max-w-[calc(100vw-8rem)] object-contain"
            style={{ display: loaded ? 'block' : 'none' }}
            draggable={false}
          />
        </div>

        {/* Next */}
        {idx < entries.length - 1 && (
          <button
            className="absolute right-3 z-10 p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            onClick={e => { e.stopPropagation(); go(1) }}
            title="Next (→)"
          >
            <ChevronRight size={36} />
          </button>
        )}
      </div>

      {/* Filmstrip */}
      {entries.length > 1 && (
        <div
          className="h-16 shrink-0 flex gap-1 items-center px-3 pb-2 overflow-x-auto"
          onClick={e => e.stopPropagation()}
        >
          {entries.map((e, i) => (
            <button
              key={e.id}
              onClick={() => { setCurrentId(e.id); setZoom(1); setLoaded(false) }}
              className={`shrink-0 h-12 w-12 rounded overflow-hidden border-2 transition-all ${
                e.id === currentId ? 'border-white opacity-100' : 'border-transparent opacity-40 hover:opacity-70'
              }`}
              title={e.name}
            >
              <img
                src={api.fs.raw(e.id)}
                alt={e.name}
                className="w-full h-full object-cover"
                loading={Math.abs(i - idx) < 5 ? 'eager' : 'lazy'}
              />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  )
}
