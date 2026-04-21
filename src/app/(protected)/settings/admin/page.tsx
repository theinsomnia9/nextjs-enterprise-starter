import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth/requireRole'
import { Role } from '@/lib/auth/roles'
import { AppError, ErrorCode } from '@/lib/errors/AppError'

export default async function AdminSettings() {
  try {
    await requireRole(Role.Admin)
  } catch (err) {
    if (err instanceof AppError && err.code === ErrorCode.FORBIDDEN) {
      redirect('/auth/unauthorized?reason=forbidden')
    }
    throw err
  }

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
