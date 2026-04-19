'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/providers/ThemeProvider'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="interactive rounded-md border border-border bg-card p-2 hover:bg-accent"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? (
        <Sun className="h-5 w-5" data-icon="sun" />
      ) : (
        <Moon className="h-5 w-5" data-icon="moon" />
      )}
    </button>
  )
}
