import Link from 'next/link'

const NAV_ROUTES = [
  {
    id: 'agent-teams',
    href: '/agent-teams',
    label: 'Agent Team Builder',
    description:
      'Design multi-agent workflows on a canvas, refine with structured forms, and iterate with a chat-driven AI designer.',
    badge: 'LangGraph',
  },
  {
    id: 'chat',
    href: '/chat',
    label: 'Chat',
    description: 'Talk to a tool-using agent with streaming responses and persisted history.',
    badge: 'SSE',
  },
  {
    id: 'approvals',
    href: '/approvals',
    label: 'Approval Queue',
    description: 'Review, lock, and action queued requests with real-time updates.',
    badge: 'Realtime',
  },
]

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 md:p-24">
      <div className="w-full max-w-5xl">
        <div className="mb-10">
          <h1 className="mb-2 text-4xl font-bold tracking-tight">Workspace</h1>
          <p className="text-lg text-muted-foreground">
            Jump into a tool. Each card opens a standalone feature.
          </p>
        </div>
        <nav aria-label="Primary">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {NAV_ROUTES.map((route) => (
              <li key={route.id} data-testid={`nav-card-${route.id}`}>
                <Link
                  href={route.href}
                  aria-label={`${route.label} — ${route.description}`}
                  className="focus-ring group flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-lg font-semibold group-hover:text-primary">
                      {route.label}
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {route.badge}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {route.description}
                  </p>
                  <span className="mt-auto text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Open →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  )
}
