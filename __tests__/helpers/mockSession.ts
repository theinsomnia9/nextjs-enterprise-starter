import { EncryptJWT, importJWK } from 'jose'
import type { Role } from '@/lib/auth/roles'

async function getKey(secret: string): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(secret)
  // Same derivation as src/lib/auth/session.ts — pad/truncate to 32 bytes
  const bytes = new Uint8Array(32)
  for (let i = 0; i < 32; i++) bytes[i] = raw[i % raw.length] ?? 0
  // Import as JWK to match the production session.ts key derivation exactly
  return importJWK(
    {
      kty: 'oct',
      k: btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, ''),
      alg: 'A256GCM',
    },
    'A256GCM'
  ) as Promise<CryptoKey>
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
