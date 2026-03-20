// web/src/components/layout/Header.tsx
import { useNavigate } from 'react-router-dom'
import { Search, Sun, Moon, Monitor } from 'lucide-react'
import { useUI } from '@/stores/ui'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export function Header() {
  const { theme, setTheme } = useUI()
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`)
  }

  const nextTheme = () => {
    const cycle: Record<string, 'light' | 'dark' | 'system'> = { light: 'dark', dark: 'system', system: 'light' }
    setTheme(cycle[theme])
  }

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor

  return (
    <header className="h-14 border-b px-6 flex items-center gap-4 shrink-0">
      <form onSubmit={onSearch} className="flex-1 max-w-xl">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search files, categories, tags…"
            className="pl-9"
          />
        </div>
      </form>
      <Button variant="ghost" size="icon" onClick={nextTheme} title="Toggle theme">
        <ThemeIcon size={18} />
      </Button>
    </header>
  )
}
