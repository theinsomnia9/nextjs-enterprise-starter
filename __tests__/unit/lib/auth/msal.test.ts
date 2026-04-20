import { describe, it, expect, beforeAll } from 'vitest'
import { setAuthEnvStub } from '../../../helpers/authEnv'

beforeAll(() =>
  setAuthEnvStub({
    AZURE_AD_CLIENT_ID: 'client-xxx',
    AZURE_AD_CLIENT_SECRET: 'secret-xxx',
    AZURE_AD_TENANT_ID: 'tenant-xxx',
  })
)

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
