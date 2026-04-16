export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 md:p-24">
      <div className="w-full max-w-5xl">
        <h1 className="mb-8 text-4xl font-bold tracking-tight">Enterprise Boilerplate</h1>
        <p className="mb-4 text-lg text-muted-foreground">Production-ready Next.js application with:</p>
        <ul className="list-inside list-disc space-y-2 text-base">
          <li>Microsoft Entra ID Authentication</li>
          <li>OpenTelemetry Observability (Jaeger + Prometheus + Grafana)</li>
          <li>Real-time Chat with Server-Sent Events</li>
          <li>Visual Workflow Builder with ReactFlow</li>
          <li>PostgreSQL with Prisma ORM</li>
          <li>Comprehensive Testing (Vitest + Playwright + MSW)</li>
          <li>Test-Driven Development (80%+ coverage)</li>
        </ul>
        <div className="mt-8 space-y-4">
          <div className="rounded-lg bg-secondary p-4">
            <p className="text-sm text-muted-foreground">
              Get started by running <code className="rounded bg-muted px-2 py-1 font-mono text-xs">npm run dev</code>
            </p>
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h3 className="mb-2 font-semibold">Try the Workflow Builder</h3>
            <a
              href="/builder"
              className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground interactive hover:bg-primary/90"
            >
              Open Builder
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
