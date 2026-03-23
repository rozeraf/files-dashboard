// web/src/components/layout/Shell.tsx
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { SelectionToolbar } from '@/components/ui/SelectionToolbar'
import { useUI } from '@/stores/ui'

export function Shell() {
  const { sidebarOpen, setSidebarOpen } = useUI()
  return (
    <div className="flex h-dvh bg-background text-foreground overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        <main className="safe-x safe-bottom flex-1 overflow-y-auto px-3 py-3 pb-24 sm:p-6 sm:pb-6">
          <div className="animate-in mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
        <SelectionToolbar />
      </div>
    </div>
  )
}
