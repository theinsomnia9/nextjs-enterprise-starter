import { EncryptJWT, jwtDecrypt, importJWK } from 'jose'
import { authConfig } from './config'
import type { Role } from './roles'

export type SessionPayload = {
  userId: string
  entraOid: string
  roles: Role[]
  name: string | null
  email: string | null
  photoUrl: string | null
  iat: number
  exp: number
}

export type SessionInput = Omit<SessionPayload, 'iat' | 'exp'>

async function getKey() {
  // jose requires 32 bytes for A256GCM. Derive deterministically from the secret.
  // Read process.env directly so key derivation always reflects the current secret
  // (important for tests that swap secrets between imports).
  const secret = process.env.AUTH_SESSION_SECRET ?? authConfig.sessionSecret
  const raw = new TextEncoder().encode(secret)
  // Simple pad/truncate to 32 bytes; prod secrets are already 32+ bytes.
  const bytes = new Uint8Array(32)
  for (let i = 0; i < 32; i++) bytes[i] = raw[i % raw.length] ?? 0
  // Import as JWK to ensure compatibility across environments (jsdom, Edge, Node).
  return importJWK(
    { kty: 'oct', k: btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''), alg: 'A256GCM' },
    'A256GCM'
  )
}

export async function encodeSession(
  input: SessionInput,
  opts: { now?: number; ttlSeconds?: number } = {}
): Promise<string> {
  const now = opts.now ?? Math.floor(Date.now() / 1000)
  const ttl = opts.ttlSeconds ?? authConfig.sessionTtlSeconds
  const exp = now + ttl

  const key = await getKey()
  return await new EncryptJWT({
    userId: input.userId,
    entraOid: input.entraOid,
    roles: input.roles,
    name: input.name,
    email: input.email,
    photoUrl: input.photoUrl,
  })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .encrypt(key)
}

export async function decodeSession(token: string): Promise<SessionPayload> {
  const key = await getKey()
  const { payload } = await jwtDecrypt(token, key)
  return {
    userId: payload.userId as string,
    entraOid: payload.entraOid as string,
    roles: payload.roles as Role[],
    name: (payload.name as string | null) ?? null,
    email: (payload.email as string | null) ?? null,
    photoUrl: (payload.photoUrl as string | null) ?? null,
    iat: payload.iat as number,
    exp: payload.exp as number,
  }
}
