// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.AUTH_SESSION_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef'
  process.env.APP_URL = 'http://localhost:3000'
  process.env.AZURE_AD_CLIENT_ID = 'x'
  process.env.AZURE_AD_CLIENT_SECRET = 'x'
  process.env.AZURE_AD_TENANT_ID = 'x'
})

const payload = {
  userId: 'u_123',
  entraOid: 'oid_abc',
  roles: ['Approver' as const],
  name: 'Alice',
  email: 'a@example.com',
  photoUrl: null,
}

describe('session encode/decode', () => {
  it('round-trips a payload', async () => {
    const { encodeSession, decodeSession } = await import('@/lib/auth/session')
    const cookie = await encodeSession(payload)
    const decoded = await decodeSession(cookie)
    expect(decoded.userId).toBe('u_123')
    expect(decoded.entraOid).toBe('oid_abc')
    expect(decoded.roles).toEqual(['Approver'])
    expect(decoded.email).toBe('a@example.com')
    expect(decoded.iat).toBeGreaterThan(0)
    expect(decoded.exp).toBe(decoded.iat + 12 * 60 * 60)
  })

  it('rejects a tampered ciphertext', async () => {
    const { encodeSession, decodeSession } = await import('@/lib/auth/session')
    const cookie = await encodeSession(payload)
    const tampered = cookie.slice(0, -2) + 'XX'
    await expect(decodeSession(tampered)).rejects.toThrow()
  })

  it('rejects an expired payload', async () => {
    const { encodeSession, decodeSession } = await import('@/lib/auth/session')
    const cookie = await encodeSession(payload, { now: Math.floor(Date.now() / 1000) - 24 * 60 * 60 })
    await expect(decodeSession(cookie)).rejects.toThrow()
  })

  it('rejects a cookie encoded with a different secret', async () => {
    const { encodeSession } = await import('@/lib/auth/session')
    const cookie = await encodeSession(payload)
    process.env.AUTH_SESSION_SECRET = 'deadbeef'.repeat(8)
    // re-import with new secret
    const fresh = await import('@/lib/auth/session?v=otherkey')
    await expect(fresh.decodeSession(cookie)).rejects.toThrow()
  })
})
