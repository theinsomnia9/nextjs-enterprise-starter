import type { ReactNode } from 'react'
import Link from 'next/link'
import { getActor } from '@/lib/auth/actor'
import { Role } from '@/lib/auth/roles'

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const actor = await getActor()
  const isAdmin = actor.roles.includes(Role.Admin)

  return (
    <div className="grid gap-6 md:grid-cols-[200px_1fr]">
      <aside className="space-y-1">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Settings
        </h2>
        <nav aria-label="Settings" className="flex flex-col gap-1 text-sm">
          <Link
            href="/settings"
            className="rounded px-2 py-1 hover:bg-accent hover:text-foreground"
          >
            Profile
          </Link>
          {isAdmin && (
            <Link
              href="/settings/admin"
              className="rounded px-2 py-1 hover:bg-accent hover:text-foreground"
            >
              Admin
            </Link>
          )}
        </nav>
      </aside>
      <section>{children}</section>
    </div>
  )
}
