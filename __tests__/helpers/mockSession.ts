import { EncryptJWT } from 'jose'
import type { Role } from '@/lib/auth/roles'

// Must match src/lib/auth/session.ts exactly — forged cookies are indistinguishable
// from production.
const HKDF_INFO = new TextEncoder().encode('nbp-auth-session:a256gcm:v1')

async function getKey(secret: string): Promise<CryptoKey> {
  const ikm = new TextEncoder().encode(secret)
  const ikmKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(), info: HKDF_INFO },
    ikmKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

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
  const secret = args.secret ?? process.env.AUTH_SESSION_SECRET ?? ''
  if (secret.length < 32)
    throw new Error('AUTH_SESSION_SECRET must be >= 32 chars for mock session')

  const now = Math.floor(Date.now() / 1000)
  const ttl = args.ttlSeconds ?? 12 * 60 * 60

  const key = await getKey(secret)

  return await new EncryptJWT({
    userId: args.userId,
    entraOid: args.entraOid ?? `oid-${args.userId}`,
    roles: args.roles,
    name: args.name ?? null,
    email: args.email ?? null,
    photoUrl: args.photoUrl ?? null,
  })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .encrypt(key)
}
