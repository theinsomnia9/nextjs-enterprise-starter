import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.AZURE_AD_CLIENT_ID = 'client-xxx'
  process.env.AZURE_AD_CLIENT_SECRET = 'secret-xxx'
  process.env.AZURE_AD_TENANT_ID = 'tenant-xxx'
  process.env.APP_URL = 'http://localhost:3000'
  process.env.AUTH_SESSION_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef'
})

describe('getMsalClient', () => {
  it('returns a ConfidentialClientApplication instance', async () => {
    const { getMsalClient } = await import('@/lib/auth/msal')
    const client = getMsalClient()
    expect(typeof client.getAuthCodeUrl).toBe('function')
    expect(typeof client.acquireTokenByCode).toBe('function')
  })

  it('returns the same instance on subsequent calls (singleton)', async () => {
    const { getMsalClient } = await import('@/lib/auth/msal')
    expect(getMsalClient()).toBe(getMsalClient())
  })
})
