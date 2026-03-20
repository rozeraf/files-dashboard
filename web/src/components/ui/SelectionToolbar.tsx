// web/src/components/ui/SelectionToolbar.tsx
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useUI } from '@/stores/ui'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Trash2, X } from 'lucide-react'

export function SelectionToolbar() {
  const { selectedIds, clearSelection } = useUI()
  const qc = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const count = selectedIds.size

  const del = useMutation({
    mutationFn: () => api.fs.delete([...selectedIds]),
    onSuccess: () => {
      // invalidate everything — pages will re-fetch
      qc.invalidateQueries()
      clearSelection()
      setConfirmOpen(false)
    },
  })

  return (
    <>
      {/* Floating toolbar — slides up when items are selected */}
      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2 rounded-full bg-background border shadow-xl transition-all duration-200 ${
          count > 0 ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0 pointer-events-none'
        }`}
      >
        <span className="text-sm font-medium tabular-nums pr-1">{count} selected</span>
        <div className="w-px h-4 bg-border" />
        <Button
          variant="ghost" size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 h-8"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 size={13} />Delete
        </Button>
        <div className="w-px h-4 bg-border" />
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={clearSelection} title="Clear selection">
          <X size={14} />
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={o => !o && setConfirmOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {count} {count === 1 ? 'file' : 'files'}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {count === 1
              ? 'This will permanently delete the file from disk.'
              : `This will permanently delete all ${count} files from disk.`}
            {' '}This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => del.mutate()} disabled={del.isPending}>
              {del.isPending ? 'Deleting…' : `Delete ${count} ${count === 1 ? 'file' : 'files'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
