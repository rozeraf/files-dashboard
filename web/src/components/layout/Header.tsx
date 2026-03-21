// web/src/components/layout/Header.tsx
import { useNavigate } from 'react-router-dom'
import { Search, Sun, Moon, Monitor, Command, Menu } from 'lucide-react'
import { useUI } from '@/stores/ui'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useState, useEffect, useRef } from 'react'

export function Header() {
  const { theme, setTheme, toggleSidebar } = useUI()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Ctrl/Cmd+K to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (q.trim()) {
      navigate(`/search?q=${encodeURIComponent(q.trim())}`)
      inputRef.current?.blur()
    }
  }

  const nextTheme = () => {
    const cycle: Record<string, 'light' | 'dark' | 'system'> = { light: 'dark', dark: 'system', system: 'light' }
    setTheme(cycle[theme])
  }

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor

  return (
    <header className="h-14 border-b px-3 sm:px-6 flex items-center gap-2 sm:gap-4 shrink-0 bg-background/80 backdrop-blur-sm">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="md:hidden h-9 w-9 shrink-0"
      >
        <Menu size={18} />
      </Button>
      <form onSubmit={onSearch} className="flex-1 max-w-xl">
        <div className="relative group">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground" />
          <Input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search files..."
            className="pl-9 pr-12 sm:pr-20 h-9 text-[13px] bg-secondary/50 border-transparent hover:border-border focus:border-ring focus:bg-background transition-all"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
            <Command size={10} />K
          </kbd>
        </div>
      </form>
      <Button
        variant="ghost"
        size="icon"
        onClick={nextTheme}
        title={`Theme: ${theme}`}
        className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
      >
        <ThemeIcon size={16} />
      </Button>
    </header>
  )
}
