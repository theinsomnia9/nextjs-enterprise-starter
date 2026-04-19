import { getServerSession } from 'next-auth'
import { AppError, ErrorCode } from '@/lib/errors/AppError'

export const DEV_ACTOR_ID = 'dev-user-alice'

/**
 * Resolve the current actor from the NextAuth session.
 *
 * - Production: requires a valid session; throws UNAUTHORIZED otherwise.
 * - Non-production: falls back to DEV_ACTOR_ID when no session is present
 *   so local development works without a full NextAuth setup.
 *
 * When real NextAuth wiring is complete, delete the dev fallback branch —
 * all call sites stay unchanged.
 */
export async function getActor(): Promise<{ id: string }> {
  const session = (await getServerSession()) as { user?: { id?: string } } | null
  const id = session?.user?.id

  if (id) return { id }

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
