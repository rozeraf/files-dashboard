import { Outlet } from 'react-router-dom'

export function Shell() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <main className="flex-1 overflow-auto p-4">
        <Outlet />
      </main>
    </div>
  )
}
