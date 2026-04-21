import { requireRole } from '@/lib/auth/requireRole'
import { Role } from '@/lib/auth/roles'

export default async function AdminSettings() {
  await requireRole(Role.Admin)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <section className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          This page is only visible to users with the <code>Admin</code> role.
          It illustrates server-side role enforcement via{' '}
          <code>requireRole(Role.Admin)</code>.
        </p>
      </section>
    </div>
  )
}
