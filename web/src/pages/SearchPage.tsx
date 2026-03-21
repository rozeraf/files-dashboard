// web/src/pages/SearchPage.tsx
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { EntryGrid } from '@/components/ui/EntryGrid'
import { EntryTable } from '@/components/ui/EntryTable'
import { EntryDetailPanel } from '@/components/ui/EntryDetailPanel'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { LayoutGrid, List, Bookmark } from 'lucide-react'

export function SearchPage() {
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()
  const [view, setView] = useState<'grid' | 'table'>('grid')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saved, setSaved] = useState(false)

  const params = Object.fromEntries(searchParams.entries())

  const { data = [], isLoading } = useQuery({
    queryKey: ['search', params],
    queryFn: () => api.search(params),
    enabled: Object.keys(params).length > 0,
  })

  const saveView = useMutation({
    mutationFn: () => api.savedViews.create(saveName, params),
    onSuccess: () => { setSaveOpen(false); setSaveName(''); setSaved(true) },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Search {params.q && <span className="text-muted-foreground font-normal">"{params.q}"</span>}
        </h1>
        <div className="flex gap-2">
          {Object.keys(params).length > 0 && !saved && (
            <Button variant="outline" size="sm" onClick={() => { setSaveName(''); setSaveOpen(true) }}>
              <Bookmark size={14} className="mr-1.5" />Save View
            </Button>
          )}
          {saved && <span className="text-xs text-muted-foreground self-center">Saved</span>}
          <div className="flex gap-1">
            <Button variant={view === 'grid' ? 'default' : 'ghost'} size="icon" onClick={() => setView('grid')}><LayoutGrid size={16} /></Button>
            <Button variant={view === 'table' ? 'default' : 'ghost'} size="icon" onClick={() => setView('table')}><List size={16} /></Button>
          </div>
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground">Searching…</p>}
      {!isLoading && data.length === 0 && Object.keys(params).length > 0 && (
        <p className="text-muted-foreground">No results.</p>
      )}

      {view === 'grid'
        ? <EntryGrid entries={data} onSelect={e => setDetailId(e.id)} />
        : <EntryTable entries={data} onSelect={e => setDetailId(e.id)} />
      }

      <EntryDetailPanel entryId={detailId} onClose={() => setDetailId(null)}
        onDeleted={() => { setDetailId(null); qc.invalidateQueries({ queryKey: ['search'] }) }}
        onRenamed={() => qc.invalidateQueries({ queryKey: ['search'] })} />

      <Dialog open={saveOpen} onOpenChange={o => !o && setSaveOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Save View</DialogTitle></DialogHeader>
          <Input placeholder="View name" value={saveName} onChange={e => setSaveName(e.target.value)} autoFocus
            onKeyDown={e => e.key === 'Enter' && saveName && saveView.mutate()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button onClick={() => saveView.mutate()} disabled={!saveName || saveView.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
