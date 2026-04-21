'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const LINKS = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    match: (p: string) => p === '/dashboard' || p.startsWith('/dashboard/'),
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
    match: (p: string) => p === '/settings' || p.startsWith('/settings/'),
  },
] as const

export default function GlobalNav() {
  const pathname = usePathname() ?? '/'

  if (pathname.startsWith('/auth/') || pathname === '/') return null

  return (
    <nav
      aria-label="Global"
      data-testid="global-nav"
      className="fixed left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card/90 px-2 py-1 shadow-sm backdrop-blur"
    >
      {LINKS.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname)
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            data-testid={`global-nav-${href.slice(1)}`}
            className={cn(
              'focus-ring flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
