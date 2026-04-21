import { getSessionForClient } from '@/lib/auth/actor'

export default async function Dashboard() {
  const session = await getSessionForClient()
  const displayName = session?.name ?? session?.email ?? 'there'

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">
        Welcome, {displayName}
      </h1>
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-medium">Getting started</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This is your application dashboard. Use Settings to view your profile
          and explore the admin-only section.
        </p>
      </section>
    </div>
  )
}
