export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8">Enterprise Boilerplate</h1>
        <p className="text-lg mb-4">
          Production-ready Next.js application with:
        </p>
        <ul className="list-disc list-inside space-y-2 text-base">
          <li>Microsoft Entra ID Authentication</li>
          <li>OpenTelemetry Observability (Jaeger + Prometheus + Grafana)</li>
          <li>Real-time Chat with Server-Sent Events</li>
          <li>Visual Workflow Builder with ReactFlow</li>
          <li>PostgreSQL with Prisma ORM</li>
          <li>Comprehensive Testing (Vitest + Playwright + MSW)</li>
          <li>Test-Driven Development (80%+ coverage)</li>
        </ul>
        <div className="mt-8 space-y-4">
          <div className="p-4 bg-secondary rounded-lg">
            <p className="text-sm text-muted-foreground">
              Get started by running <code className="bg-muted px-2 py-1 rounded">npm run dev</code>
            </p>
          </div>
          <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
            <h3 className="font-semibold mb-2">Try the Workflow Builder</h3>
            <a
              href="/builder"
              className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm"
            >
              Open Builder
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
