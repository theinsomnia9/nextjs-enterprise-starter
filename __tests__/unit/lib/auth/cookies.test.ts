import { describe, it, expect, beforeAll } from 'vitest'
import { setAuthEnvStub } from '../../../helpers/authEnv'

beforeAll(() => setAuthEnvStub())

describe('validateReturnTo', () => {
  it('accepts same-origin relative paths', async () => {
    const { validateReturnTo } = await import('@/lib/auth/cookies')
    expect(validateReturnTo('/dashboard')).toBe('/dashboard')
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
  it('sessionCookieOptions is HttpOnly + SameSite=Lax + Path=/ (Secure gated on https)', async () => {
    const { sessionCookieOptions } = await import('@/lib/auth/cookies')
    const o = sessionCookieOptions()
    expect(o.httpOnly).toBe(true)
    // APP_URL is http://localhost in tests, so Secure is off to avoid browsers dropping cookies
    expect(o.secure).toBe(false)
    expect(o.sameSite).toBe('lax')
    expect(o.path).toBe('/')
    expect(o.maxAge).toBe(12 * 60 * 60)
  })

  it('oauthPendingCookieOptions is scoped to /auth/callback', async () => {
    const { oauthPendingCookieOptions } = await import('@/lib/auth/cookies')
    const o = oauthPendingCookieOptions()
    expect(o.httpOnly).toBe(true)
    expect(o.secure).toBe(false)
    expect(o.sameSite).toBe('lax')
    expect(o.path).toBe('/auth/callback')
    expect(o.maxAge).toBe(10 * 60)
  })
})
