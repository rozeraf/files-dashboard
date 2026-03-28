import { create } from 'zustand'

type Theme = 'light' | 'dark' | 'system'

interface UIState {
  theme: Theme
  sidebarOpen: boolean
  selectedIds: Set<string>
  setTheme: (t: Theme) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  selectEntry: (id: string, multi: boolean) => void
  clearSelection: () => void
}

const isDesktop = () => window.innerWidth >= 768

export const useUI = create<UIState>((set) => ({
  theme: (localStorage.getItem('theme') as Theme) || 'system',
  sidebarOpen: isDesktop() ? localStorage.getItem('sidebarOpen') !== 'false' : false,
  selectedIds: new Set(),

  setTheme: (t) => {
    localStorage.setItem('theme', t)
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = t === 'dark' || (t === 'system' && prefersDark)
    document.documentElement.classList.toggle('dark', isDark)
    set({ theme: t })
  },

  toggleSidebar: () => set((s) => {
    const next = !s.sidebarOpen
    if (isDesktop()) localStorage.setItem('sidebarOpen', String(next))
    return { sidebarOpen: next }
  }),
  setSidebarOpen: (open) => {
    if (isDesktop()) localStorage.setItem('sidebarOpen', String(open))
    set({ sidebarOpen: open })
  },

  selectEntry: (id, multi) => set((s) => {
    const next = new Set(multi ? s.selectedIds : [])
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return { selectedIds: next }
  }),

  clearSelection: () => set({ selectedIds: new Set() }),
}))
