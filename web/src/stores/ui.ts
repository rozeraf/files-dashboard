import { create } from 'zustand'

type Theme = 'light' | 'dark' | 'system'

interface UIState {
  theme: Theme
  sidebarOpen: boolean
  selectedIds: Set<string>
  setTheme: (t: Theme) => void
  toggleSidebar: () => void
  selectEntry: (id: string, multi: boolean) => void
  clearSelection: () => void
}

export const useUI = create<UIState>((set) => ({
  theme: (localStorage.getItem('theme') as Theme) || 'system',
  sidebarOpen: true,
  selectedIds: new Set(),

  setTheme: (t) => {
    localStorage.setItem('theme', t)
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = t === 'dark' || (t === 'system' && prefersDark)
    document.documentElement.classList.toggle('dark', isDark)
    set({ theme: t })
  },

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  selectEntry: (id, multi) => set((s) => {
    const next = new Set(multi ? s.selectedIds : [])
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return { selectedIds: next }
  }),

  clearSelection: () => set({ selectedIds: new Set() }),
}))
