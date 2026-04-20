'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, MessageSquare, Users, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/', label: 'Home', icon: Home, match: (p: string) => p === '/' },
  {
    href: '/chat',
    label: 'Chat',
    icon: MessageSquare,
    match: (p: string) => p === '/chat' || p.startsWith('/chat/'),
  },
  {
    href: '/agent-teams',
    label: 'Team Builder',
    icon: Users,
    match: (p: string) => p === '/agent-teams' || p.startsWith('/agent-teams/'),
  },
  {
    href: '/approvals',
    label: 'Approvals',
    icon: Inbox,
    match: (p: string) => p === '/approvals' || p.startsWith('/approvals/'),
  },
] as const

export default function GlobalNav() {
  const pathname = usePathname() ?? '/'

  if (pathname.startsWith('/auth/')) return null

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
            data-testid={`global-nav-${href === '/' ? 'home' : href.slice(1)}`}
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
