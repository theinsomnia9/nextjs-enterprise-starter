'use client'

import { usePathname } from 'next/navigation'
import { LogOut, Moon, Sun } from 'lucide-react'

import { useSession } from '@/components/auth/session-provider'
import { useTheme } from '@/providers/ThemeProvider'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  initialsFor,
  primaryRole,
  roleBadgeClasses,
} from '@/components/auth/userMenuHelpers'

export default function UserMenu() {
  const session = useSession()
  const pathname = usePathname() ?? '/'
  const { theme, toggleTheme } = useTheme()

  if (!session) return null
  if (pathname.startsWith('/auth/')) return null

  const role = primaryRole(session.roles)
  const initials = initialsFor({ name: session.name, email: session.email })
  const displayName = session.name?.trim() || session.email || 'Account'

  return (
    <div className="fixed right-3 top-3 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open user menu"
            className="h-9 w-9 rounded-full border border-border bg-card/80 p-0 shadow-sm backdrop-blur hover:bg-accent"
          >
            <Avatar className="h-9 w-9">
              <AvatarImage src={session.photoUrl ?? undefined} alt="" />
              <AvatarFallback className="text-xs font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-64">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar className="h-9 w-9">
              <AvatarImage src={session.photoUrl ?? undefined} alt="" />
              <AvatarFallback className="text-xs font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              {session.name ? (
                <div className="truncate text-sm font-medium" title={session.name}>
                  {session.name}
                </div>
              ) : null}
              {session.email ? (
                <div
                  className="truncate text-xs text-muted-foreground"
                  title={session.email}
                >
                  {session.email}
                </div>
              ) : null}
              <div className="mt-1">
                <span
                  className={roleBadgeClasses(role)}
                  aria-label={`Role: ${role}`}
                >
                  {role}
                </span>
              </div>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            data-testid="user-menu-theme"
            onSelect={(e) => {
              e.preventDefault()
              toggleTheme()
            }}
            className="gap-2"
          >
            {theme === 'light' ? (
              <Moon className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Sun className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <form method="POST" action="/auth/signout">
            <DropdownMenuItem asChild>
              <button
                type="submit"
                data-testid="user-menu-signout"
                className="flex w-full cursor-default items-center gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>Sign out</span>
                <span className="sr-only">, {displayName}</span>
              </button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
