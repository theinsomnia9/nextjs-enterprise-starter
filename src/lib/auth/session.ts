import { EncryptJWT, jwtDecrypt } from 'jose'
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

// HKDF context: bump this version string if the cookie format changes so old
// cookies fail to decode cleanly rather than decrypting to garbage.
const HKDF_INFO = new TextEncoder().encode('nbp-auth-session:a256gcm:v1')

// Cache the derived key keyed on the secret so HKDF runs once per process
// (re-derives only when the secret changes, e.g. tests swapping it between imports).
let cachedKey: { secret: string; key: CryptoKey } | null = null

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SESSION_SECRET ?? authConfig.sessionSecret
  if (cachedKey && cachedKey.secret === secret) return cachedKey.key
  const ikm = new TextEncoder().encode(secret)
  const ikmKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(), info: HKDF_INFO },
    ikmKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
  cachedKey = { secret, key }
  return key
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
