import { encodeSession } from '@/lib/auth/session'
import type { Role } from '@/lib/auth/roles'

export async function buildSessionCookie(args: {
  userId: string
  entraOid?: string
  roles: Role[]
  name?: string | null
  email?: string | null
  photoUrl?: string | null
  ttlSeconds?: number
  secret?: string
}): Promise<string> {
  const prevSecret = process.env.AUTH_SESSION_SECRET
  if (args.secret) process.env.AUTH_SESSION_SECRET = args.secret
  try {
    return await encodeSession(
      {
        userId: args.userId,
        entraOid: args.entraOid ?? `oid-${args.userId}`,
        roles: args.roles,
        name: args.name ?? null,
        email: args.email ?? null,
        photoUrl: args.photoUrl ?? null,
      },
      { ttlSeconds: args.ttlSeconds }
    )
  } finally {
    if (args.secret) process.env.AUTH_SESSION_SECRET = prevSecret
  }
}
