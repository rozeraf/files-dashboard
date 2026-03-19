import { create } from 'zustand'

type Theme = 'light' | 'dark' | 'system'

interface UIState {
  theme: Theme
  sidebarCollapsed: boolean
  selected: Set<string>
  setTheme: (t: Theme) => void
  toggleSidebar: () => void
  toggleSelect: (id: string) => void
  clearSelection: () => void
}

export const useUIStore = create<UIState>((set) => ({
  theme: (localStorage.getItem('theme') as Theme) ?? 'system',
  sidebarCollapsed: false,
  selected: new Set(),

  setTheme: (theme) => {
    localStorage.setItem('theme', theme)
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = theme === 'dark' || (theme === 'system' && prefersDark)
    document.documentElement.classList.toggle('dark', isDark)
    set({ theme })
  },

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  toggleSelect: (id) =>
    set((s) => {
      const next = new Set(s.selected)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selected: next }
    }),

  clearSelection: () => set({ selected: new Set() }),
}))
