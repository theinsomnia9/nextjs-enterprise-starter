import { cookies } from 'next/headers'
import { AppError, ErrorCode } from '@/lib/errors/AppError'
import { authConfig } from './config'
import {
  sessionCookieOptions,
  SESSION_COOKIE,
} from './cookies'
import { decodeSession, encodeSession, type SessionPayload } from './session'
import type { Role } from './roles'

export type Actor = {
  id: string
  roles: Role[]
}

function unauthorized(): AppError {
  return new AppError({
    statusCode: 401,
    code: ErrorCode.UNAUTHORIZED,
    message: 'Sign in required',
  })
}

async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies()
  const raw = store.get(SESSION_COOKIE)?.value
  if (!raw) return null
  try {
    return await decodeSession(raw)
  } catch {
    return null
  }
}

async function maybeRefresh(session: SessionPayload): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  if (now - session.iat < authConfig.slidingRefreshThresholdSeconds) return

  try {
    const fresh = await encodeSession({
      userId: session.userId,
      entraOid: session.entraOid,
      roles: session.roles,
      name: session.name,
      email: session.email,
      photoUrl: session.photoUrl,
    })
    const store = await cookies()
    store.set(SESSION_COOKIE, fresh, sessionCookieOptions())
  } catch {
    // Server components can't set cookies; swallow. Refresh will happen on
    // the next Server Action / Route Handler touch.
  }
}

export async function getActor(): Promise<Actor> {
  const session = await readSession()
  if (!session) throw unauthorized()
  await maybeRefresh(session)
  return { id: session.userId, roles: session.roles }
}

/** @deprecated Prefer getActor() which returns roles. */
export async function getActorId(): Promise<string> {
  const actor = await getActor()
  return actor.id
}

export async function getSessionForClient(): Promise<{
  userId: string
  roles: Role[]
  name: string | null
  email: string | null
  photoUrl: string | null
} | null> {
  const session = await readSession()
  if (!session) return null
  return {
    userId: session.userId,
    roles: session.roles,
    name: session.name,
    email: session.email,
    photoUrl: session.photoUrl,
  }
}
