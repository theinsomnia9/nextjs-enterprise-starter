// Shared stub for the minimum env vars that auth/config requires at import time.
// Tests that only need "some valid value" should call this; tests asserting on
// specific values (config.test.ts) should set env inline instead.

export function setAuthEnvStub(overrides: Partial<Record<string, string>> = {}) {
  process.env.AUTH_SESSION_SECRET =
    overrides.AUTH_SESSION_SECRET ??
    '0123456789abcdef0123456789abcdef0123456789abcdef'
  process.env.APP_URL = overrides.APP_URL ?? 'http://localhost:3000'
  process.env.AZURE_AD_CLIENT_ID = overrides.AZURE_AD_CLIENT_ID ?? 'x'
  process.env.AZURE_AD_CLIENT_SECRET = overrides.AZURE_AD_CLIENT_SECRET ?? 'x'
  process.env.AZURE_AD_TENANT_ID = overrides.AZURE_AD_TENANT_ID ?? 'x'
}
