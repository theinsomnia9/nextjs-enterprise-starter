import { getSessionForClient } from '@/lib/auth/actor'
import { primaryRole } from '@/components/auth/userMenuHelpers'

export default async function Settings() {
  const session = await getSessionForClient()
  if (!session) return null

  const role = primaryRole(session.roles)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      <dl className="grid gap-4 text-sm sm:grid-cols-[120px_1fr]">
        <dt className="text-muted-foreground">Name</dt>
        <dd>{session.name ?? '—'}</dd>

        <dt className="text-muted-foreground">Email</dt>
        <dd>{session.email ?? '—'}</dd>

        <dt className="text-muted-foreground">Role</dt>
        <dd>{role}</dd>
      </dl>
    </div>
  )
}
