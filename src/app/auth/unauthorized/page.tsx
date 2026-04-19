type Reason = 'token_exchange' | 'entra' | 'provisioning' | 'forbidden' | 'unknown'

const MESSAGES: Record<Reason, string> = {
  token_exchange: 'We could not complete sign-in with Microsoft. Please try again.',
  entra: 'Microsoft reported an error during sign-in. Please contact your administrator if this persists.',
  provisioning: 'Your account could not be provisioned. Please contact your administrator.',
  forbidden: 'You do not have permission to access that resource.',
  unknown: 'Sign-in is not available right now. Please try again.',
}

export default async function UnauthorizedPage(props: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await props.searchParams
  const validReasons = ['token_exchange', 'entra', 'provisioning', 'forbidden'] as const
  const known: Reason = validReasons.includes(reason as never) ? (reason as Reason) : 'unknown'

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <h1 className="text-2xl font-semibold">Sign-in required</h1>
      <p className="text-muted-foreground">{MESSAGES[known]}</p>
      <a
        href="/auth/signin"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Sign in again
      </a>
    </main>
  )
}
