import Link from 'next/link'
import ThemeToggle from '@/components/theme/ThemeToggle'

const NAV_ROUTES = [
  {
    id: 'chat',
    href: '/chat',
    label: 'Chat',
    description: 'Real-time chat interface with Server-Sent Events and message history.',
    badge: 'SSE',
  },
  {
    id: 'builder',
    href: '/builder',
    label: 'Workflow Builder',
    description: 'Visual node-based workflow builder powered by ReactFlow.',
    badge: 'ReactFlow',
  },
  {
    id: 'approvals',
    href: '/approvals',
    label: 'Approvals',
    description: 'Approval queue dashboard for reviewing and actioning workflow requests.',
    badge: 'Queue',
  },
]

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 md:p-24">
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-3xl">
        <div className="mb-10">
          <h1 className="mb-2 text-4xl font-bold tracking-tight">Dev Navigation</h1>
          <p className="text-lg text-muted-foreground">
            Navigate across features during development. Click any card to open the route.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NAV_ROUTES.map((route) => (
            <div key={route.id} data-testid={`nav-card-${route.id}`}>
              <Link
                href={route.href}
                className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold group-hover:text-primary">
                    {route.label}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {route.badge}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{route.description}</p>
                <span className="mt-auto text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Open →
                </span>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
