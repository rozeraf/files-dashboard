// web/src/components/layout/Sidebar.tsx
import { NavLink, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useUI } from '@/stores/ui'
import {
  Home, Library, FolderOpen, Tag, Clock, Heart,
  HelpCircle, Files, Settings, ChevronRight, Search, X
} from 'lucide-react'
import { useState, useEffect } from 'react'

export function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useUI()
  const location = useLocation()
  const { data: libraries } = useQuery({ queryKey: ['libraries'], queryFn: api.libraries.list })
  const [expandedLibs, setExpandedLibs] = useState<Set<string>>(new Set())

  // Close sidebar on route change (mobile only)
  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false)
  }, [location.pathname, setSidebarOpen])

  const toggle = (id: string) => setExpandedLibs(p => {
    const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  const navItem = (to: string, icon: React.ReactNode, label: string) => (
    <NavLink
      to={to}
      className={({ isActive }) => cn(
        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150',
        isActive
          ? 'bg-sidebar-accent text-sidebar-primary shadow-sm'
          : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
      )}
    >
      {icon}{label}
    </NavLink>
  )

  return (
    <aside className={cn(
      'safe-x safe-top safe-bottom fixed inset-y-0 left-0 z-50 w-[min(86vw,20rem)] sm:w-60 shrink-0 h-screen overflow-y-auto border-r border-sidebar-border bg-sidebar p-3 shadow-2xl flex flex-col gap-0.5',
      'transition-transform duration-200 ease-out',
      'md:relative md:z-auto md:translate-x-0 md:shadow-none',
      sidebarOpen ? 'translate-x-0' : '-translate-x-full'
    )}>
      <div className="px-3 py-3 mb-1 flex items-center justify-between">
        <h1 className="text-sm font-bold tracking-tight text-sidebar-foreground">Files Dashboard</h1>
        <button
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
          className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl border border-sidebar-border/70 bg-sidebar-accent/60 text-sidebar-foreground shadow-sm transition-colors hover:bg-sidebar-accent"
        >
          <X size={16} />
        </button>
      </div>

      {navItem('/home', <Home size={15} />, 'Home')}
      {navItem('/search', <Search size={15} />, 'Search')}

      <div className="mt-4 mb-1.5 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">Libraries</div>
      {libraries?.map(lib => (
        <div key={lib.id}>
          <div className="flex items-center">
            <NavLink
              to={`/libraries/${lib.id}`}
              className={({ isActive }) => cn(
                'flex-1 flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <span className="text-base leading-none">{lib.icon}</span>{lib.name}
            </NavLink>
            <button
              onClick={() => toggle(lib.id)}
              className="p-1 rounded text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
            >
              <div className={cn('transition-transform duration-200', expandedLibs.has(lib.id) && 'rotate-90')}>
                <ChevronRight size={13} />
              </div>
            </button>
          </div>
          <div className={cn(
            'overflow-hidden transition-all duration-200',
            expandedLibs.has(lib.id) ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          )}>
            <LibraryCategories libraryId={lib.id} />
          </div>
        </div>
      ))}

      <div className="mt-4 mb-1.5 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">Organize</div>
      {navItem('/collections', <Library size={15} />, 'Collections')}
      {navItem('/tags', <Tag size={15} />, 'Tags')}
      {navItem('/saved-views', <FolderOpen size={15} />, 'Saved Views')}

      <div className="mt-4 mb-1.5 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">Discover</div>
      {navItem('/recent', <Clock size={15} />, 'Recent')}
      {navItem('/favorites', <Heart size={15} />, 'Favorites')}
      {navItem('/uncategorized', <HelpCircle size={15} />, 'Uncategorized')}

      <div className="mt-auto pt-3 border-t border-sidebar-border flex flex-col gap-0.5">
        {navItem('/files', <Files size={15} />, 'Files')}
        {navItem('/settings', <Settings size={15} />, 'Settings')}
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
    <div className="ml-4 pl-2 border-l border-sidebar-border flex flex-col gap-0.5 py-1">
      {tree?.map(cat => <CategoryNavItem key={cat.id} cat={cat} depth={0} />)}
    </div>
  )
}

function CategoryNavItem({ cat, depth }: { cat: import('@/lib/api').Category; depth: number }) {
  return (
    <>
      <NavLink
        to={`/categories/${cat.id}`}
        className={({ isActive }) => cn(
          'block px-2.5 py-1 rounded-md text-xs truncate transition-all duration-150',
          isActive
            ? 'text-sidebar-primary font-medium bg-sidebar-accent/60'
            : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/30'
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {cat.name}
      </NavLink>
      {cat.children?.map(child => <CategoryNavItem key={child.id} cat={child} depth={depth + 1} />)}
    </>
  )
}
