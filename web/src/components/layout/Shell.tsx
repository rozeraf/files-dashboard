// web/src/components/layout/Shell.tsx
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useUI } from '@/stores/ui'
import { cn } from '@/lib/utils'

export function Shell() {
  const { sidebarOpen } = useUI()
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <div className={cn('flex flex-col flex-1 min-w-0 transition-all', sidebarOpen ? 'ml-0' : 'ml-0')}>
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
