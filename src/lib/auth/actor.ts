import { AppError, ErrorCode } from '@/lib/errors/AppError'

export const DEV_ACTOR_ID = 'dev-user-alice'

/**
 * Resolve the current actor. NextAuth v5 wiring is not yet in place
 * (no `auth.ts` config module). Until it is, dev falls back to
 * DEV_ACTOR_ID and production refuses unauthenticated access. When
 * v5's `auth()` is wired, call it here and return `{ id: session.user.id }`.
 */
export async function getActor(): Promise<{ id: string }> {
  if (process.env.NODE_ENV !== 'production') {
    return { id: DEV_ACTOR_ID }
  }

  throw new AppError({
    statusCode: 401,
    code: ErrorCode.UNAUTHORIZED,
    message: 'Sign in required',
  })
}

/** @deprecated Use getActor() instead. Kept for route handlers removed in PR 2. */
export async function getActorId(): Promise<string> {
  const actor = await getActor()
  return actor.id
}
