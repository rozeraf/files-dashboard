import { useEffect, useState } from 'react'
import { type Entry } from '@/lib/api'

export const isImageEntry = (entry: Entry) => entry.mime?.startsWith('image/')
export const isVideoEntry = (entry: Entry) => entry.mime?.startsWith('video/')
export const isMediaEntry = (entry: Entry) => isImageEntry(entry) || isVideoEntry(entry)

const TEXT_MIMES = new Set([
  'application/json', 'application/xml', 'application/javascript',
  'application/typescript', 'application/x-sh', 'application/x-yaml',
])
const TEXT_EXTS = new Set([
  'txt', 'md', 'log', 'csv', 'yaml', 'yml', 'toml', 'ini', 'conf',
  'env', 'sh', 'bash', 'zsh', 'fish', 'json', 'xml',
])
export const isTextEntry = (entry: Entry) =>
  entry.mime?.startsWith('text/') ||
  TEXT_MIMES.has(entry.mime) ||
  TEXT_EXTS.has(entry.ext?.toLowerCase() ?? '')

export const isViewableEntry = (entry: Entry) =>
  isMediaEntry(entry) || isTextEntry(entry)

export function useMediaViewer(entries: Entry[], lightboxEntries?: Entry[]) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const mediaEntries = (lightboxEntries ?? entries).filter(isViewableEntry)

  useEffect(() => {
    if (!activeId) return
    if (mediaEntries.some(entry => entry.id === activeId)) return
    setActiveId(mediaEntries[0]?.id ?? null)
  }, [activeId, mediaEntries])

  const open = (entry: Entry) => {
    if (!isViewableEntry(entry)) return false
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
