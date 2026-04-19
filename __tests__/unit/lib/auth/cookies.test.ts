import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.AUTH_SESSION_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef'
  process.env.APP_URL = 'http://localhost:3000'
  process.env.AZURE_AD_CLIENT_ID = 'x'
  process.env.AZURE_AD_CLIENT_SECRET = 'x'
  process.env.AZURE_AD_TENANT_ID = 'x'
})

describe('validateReturnTo', () => {
  it('accepts same-origin relative paths', async () => {
    const { validateReturnTo } = await import('@/lib/auth/cookies')
    expect(validateReturnTo('/approvals/123')).toBe('/approvals/123')
    expect(validateReturnTo('/')).toBe('/')
    expect(validateReturnTo('/deep/path?x=1&y=2')).toBe('/deep/path?x=1&y=2')
  })

  it('rejects absolute URLs', async () => {
    const { validateReturnTo } = await import('@/lib/auth/cookies')
    expect(validateReturnTo('http://evil.com/x')).toBeNull()
    expect(validateReturnTo('https://evil.com/x')).toBeNull()
  })

  it('rejects protocol-relative URLs', async () => {
    const { validateReturnTo } = await import('@/lib/auth/cookies')
    expect(validateReturnTo('//evil.com/x')).toBeNull()
  })

  it('rejects javascript: and data: URIs', async () => {
    const { validateReturnTo } = await import('@/lib/auth/cookies')
    expect(validateReturnTo('javascript:alert(1)')).toBeNull()
    expect(validateReturnTo('data:text/html,<script>')).toBeNull()
  })

  it('returns null for undefined / empty / non-string', async () => {
    const { validateReturnTo } = await import('@/lib/auth/cookies')
    expect(validateReturnTo(undefined)).toBeNull()
    expect(validateReturnTo('')).toBeNull()
    expect(validateReturnTo(null)).toBeNull()
  })
})

describe('cookie options', () => {
  it('sessionCookieOptions is HttpOnly + Secure + SameSite=Lax + Path=/', async () => {
    const { sessionCookieOptions } = await import('@/lib/auth/cookies')
    const o = sessionCookieOptions()
    expect(o.httpOnly).toBe(true)
    expect(o.secure).toBe(true)
    expect(o.sameSite).toBe('lax')
    expect(o.path).toBe('/')
    expect(o.maxAge).toBe(12 * 60 * 60)
  })

  it('oauthPendingCookieOptions is scoped to /auth/callback', async () => {
    const { oauthPendingCookieOptions } = await import('@/lib/auth/cookies')
    const o = oauthPendingCookieOptions()
    expect(o.httpOnly).toBe(true)
    expect(o.secure).toBe(true)
    expect(o.sameSite).toBe('lax')
    expect(o.path).toBe('/auth/callback')
    expect(o.maxAge).toBe(10 * 60)
  })
})
