import { describe, it, expect, beforeEach, afterEach } from 'vitest'

const REQUIRED_KEYS = [
  'AZURE_AD_CLIENT_ID',
  'AZURE_AD_CLIENT_SECRET',
  'AZURE_AD_TENANT_ID',
  'AUTH_SESSION_SECRET',
  'APP_URL',
] as const

describe('auth/config', () => {
  const originalEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const k of REQUIRED_KEYS) originalEnv[k] = process.env[k]
    for (const k of REQUIRED_KEYS) process.env[k] = 'test-value'
    process.env.AUTH_SESSION_SECRET = 'a'.repeat(44) // 32 base64-decoded bytes is 44 chars
    process.env.APP_URL = 'http://localhost:3000'
  })

  afterEach(() => {
    for (const k of REQUIRED_KEYS) {
      if (originalEnv[k] === undefined) delete process.env[k]
      else process.env[k] = originalEnv[k]
    }
  })

  it('exposes a typed authConfig when all env vars are set', async () => {
    const { authConfig } = await import('@/lib/auth/config')
    expect(authConfig.clientId).toBe('test-value')
    expect(authConfig.tenantId).toBe('test-value')
    expect(authConfig.clientSecret).toBe('test-value')
    expect(authConfig.appUrl).toBe('http://localhost:3000')
    expect(authConfig.authorityUrl).toBe('https://login.microsoftonline.com/test-value')
    expect(authConfig.redirectUri).toBe('http://localhost:3000/auth/callback')
  })

  it('throws when a required env var is missing', async () => {
    delete process.env.AZURE_AD_CLIENT_ID
    await expect(import('@/lib/auth/config?v=missing')).rejects.toThrow(/AZURE_AD_CLIENT_ID/)
  })

  it('throws when AUTH_SESSION_SECRET is too short', async () => {
    process.env.AUTH_SESSION_SECRET = 'short'
    await expect(import('@/lib/auth/config?v=short')).rejects.toThrow(/AUTH_SESSION_SECRET/)
  })
})
