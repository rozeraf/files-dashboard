// web/src/components/layout/Sidebar.tsx
import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  Home, Library, FolderOpen, Tag, Clock, Heart,
  HelpCircle, Files, Settings, ChevronRight, ChevronDown
} from 'lucide-react'
import { useState } from 'react'

export function Sidebar() {
  const { data: libraries } = useQuery({ queryKey: ['libraries'], queryFn: api.libraries.list })
  const [expandedLibs, setExpandedLibs] = useState<Set<string>>(new Set())

  const toggle = (id: string) => setExpandedLibs(p => {
    const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  const navItem = (to: string, icon: React.ReactNode, label: string) => (
    <NavLink
      to={to}
      className={({ isActive }) => cn(
        'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
        isActive
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {icon}{label}
    </NavLink>
  )

  return (
    <aside className="w-60 shrink-0 h-screen overflow-y-auto border-r bg-sidebar p-3 flex flex-col gap-1">
      {navItem('/home', <Home size={16} />, 'Home')}

      <div className="mt-2 mb-1 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Libraries</div>
      {libraries?.map(lib => (
        <div key={lib.id}>
          <div className="flex items-center">
            <NavLink
              to={`/libraries/${lib.id}`}
              className={({ isActive }) => cn(
                'flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md text-sm',
                isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <span>{lib.icon}</span>{lib.name}
            </NavLink>
            <button onClick={() => toggle(lib.id)} className="p-1 text-muted-foreground hover:text-foreground">
              {expandedLibs.has(lib.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>
          {expandedLibs.has(lib.id) && <LibraryCategories libraryId={lib.id} />}
        </div>
      ))}

      <div className="mt-3 border-t pt-2 flex flex-col gap-1">
        {navItem('/collections', <Library size={16} />, 'Collections')}
        {navItem('/tags', <Tag size={16} />, 'Tags')}
        {navItem('/saved-views', <FolderOpen size={16} />, 'Saved Views')}
      </div>

      <div className="mt-2 border-t pt-2 flex flex-col gap-1">
        {navItem('/recent', <Clock size={16} />, 'Recent')}
        {navItem('/favorites', <Heart size={16} />, 'Favorites')}
        {navItem('/uncategorized', <HelpCircle size={16} />, 'Uncategorized')}
      </div>

      <div className="mt-auto border-t pt-2 flex flex-col gap-1">
        {navItem('/files', <Files size={16} />, 'Files')}
        {navItem('/settings', <Settings size={16} />, 'Settings')}
      </div>
    </aside>
  )
}

function LibraryCategories({ libraryId }: { libraryId: string }) {
  const { data: tree } = useQuery({
    queryKey: ['categories', libraryId],
    queryFn: () => api.libraries.categories(libraryId),
  })
  return (
    <div className="ml-4 flex flex-col gap-0.5">
      {tree?.map(cat => (
        <NavLink
          key={cat.id}
          to={`/categories/${cat.id}`}
          className={({ isActive }) => cn(
            'px-3 py-1 rounded text-xs truncate',
            isActive ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {cat.name}
        </NavLink>
      ))}
    </div>
  )
}
