import { useEffect } from 'react'

export function asFileList(files: File[]): FileList {
  const dt = new DataTransfer()
  files.forEach(f => dt.items.add(f))
  return dt.files
}

export function usePasteUpload(
  callback: (files: File[]) => void,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled) return

    const handler = (e: ClipboardEvent) => {
      const cd = e.clipboardData
      if (!cd) return

      let files: File[] = Array.from(cd.files)

      // Fallback for browsers (e.g. Firefox on Linux) that don't populate .files
      if (files.length === 0) {
        files = Array.from(cd.items)
          .filter(item => item.kind === 'file')
          .map(item => item.getAsFile())
          .filter((f): f is File => f !== null)
      }

      if (files.length > 0) callback(files)
    }

    document.addEventListener('paste', handler)
    return () => document.removeEventListener('paste', handler)
  }, [enabled, callback])
}
