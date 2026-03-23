import { useEffect, useState } from 'react'
import { type Entry } from '@/lib/api'

export const isImageEntry = (entry: Entry) => entry.mime?.startsWith('image/')
export const isVideoEntry = (entry: Entry) => entry.mime?.startsWith('video/')
export const isMediaEntry = (entry: Entry) => isImageEntry(entry) || isVideoEntry(entry)

export function useMediaViewer(entries: Entry[], lightboxEntries?: Entry[]) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const mediaEntries = (lightboxEntries ?? entries).filter(isMediaEntry)

  useEffect(() => {
    if (!activeId) return
    if (mediaEntries.some(entry => entry.id === activeId)) return
    setActiveId(mediaEntries[0]?.id ?? null)
  }, [activeId, mediaEntries])

  const open = (entry: Entry) => {
    if (!isMediaEntry(entry)) return false
    setActiveId(entry.id)
    return true
  }

  return {
    activeId,
    mediaEntries,
    close: () => setActiveId(null),
    open,
  }
}
