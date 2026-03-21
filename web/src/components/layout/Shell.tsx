// web/src/components/layout/Shell.tsx
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { SelectionToolbar } from '@/components/ui/SelectionToolbar'

export function Shell() {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="animate-in max-w-6xl">
            <Outlet />
          </div>
        </main>
        <SelectionToolbar />
      </div>
    </div>
  )
}
