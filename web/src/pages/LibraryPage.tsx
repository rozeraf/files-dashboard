// web/src/pages/LibraryPage.tsx
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState } from 'react'
import { EntryDetailPanel } from '@/components/ui/EntryDetailPanel'

export function LibraryPage() {
  const { libraryId } = useParams<{ libraryId: string }>()
  const navigate = useNavigate()
  const [detailId, setDetailId] = useState<string | null>(null)

  const { data: library } = useQuery({ queryKey: ['library', libraryId], queryFn: () => api.libraries.get(libraryId!) })
  const { data: tree } = useQuery({ queryKey: ['categories', libraryId], queryFn: () => api.libraries.categories(libraryId!) })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{library?.icon} {library?.name}</h1>

      {tree && tree.length > 0 && (
        <section>
          <h2 className="text-lg font-medium mb-3">Categories</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {tree.map(cat => (
              <button
                key={cat.id}
                onClick={() => navigate(`/categories/${cat.id}`)}
                className="p-4 rounded-xl border bg-card hover:border-primary/50 hover:shadow-sm transition-all text-left"
              >
                <p className="font-medium text-sm">{cat.name}</p>
                {cat.children && cat.children.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{cat.children.length} subcategories</p>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      <EntryDetailPanel entryId={detailId} onClose={() => setDetailId(null)} />
    </div>
  )
}
