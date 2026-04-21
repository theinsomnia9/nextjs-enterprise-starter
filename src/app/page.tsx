import Link from 'next/link'
import { getSessionForClient } from '@/lib/auth/actor'
import { Button } from '@/components/ui/button'

export default async function Home() {
  const session = await getSessionForClient()
  const href = session ? '/dashboard' : '/auth/signin'
  const ctaLabel = session ? 'Go to dashboard' : 'Sign in'

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 text-center">
      <div className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Next.js Enterprise Boilerplate
        </h1>
        <p className="max-w-xl text-balance text-muted-foreground">
          A production-ready starter with Microsoft Entra ID authentication,
          OpenTelemetry observability, Prisma + Postgres, and a TDD harness.
        </p>
      </div>
      <Button asChild size="lg">
        <Link href={href}>{ctaLabel}</Link>
      </Button>
    </main>
  )
}
