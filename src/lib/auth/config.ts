function required(name: string): string {
  const v = process.env[name]
  if (!v || v.length === 0) {
    throw new Error(`[auth/config] Missing required env var: ${name}`)
  }
  return v
}

function requiredMinLength(name: string, min: number): string {
  const v = required(name)
  if (v.length < min) {
    throw new Error(`[auth/config] ${name} must be at least ${min} characters (got ${v.length})`)
  }
  return v
}

const clientId = required('AZURE_AD_CLIENT_ID')
const clientSecret = required('AZURE_AD_CLIENT_SECRET')
const tenantId = required('AZURE_AD_TENANT_ID')
const appUrl = required('APP_URL').replace(/\/$/, '')
const sessionSecret = requiredMinLength('AUTH_SESSION_SECRET', 32)

export const authConfig = {
  clientId,
  clientSecret,
  tenantId,
  appUrl,
  sessionSecret,
  authorityUrl: `https://login.microsoftonline.com/${tenantId}`,
  redirectUri: `${appUrl}/auth/callback`,
  scopes: ['openid', 'profile', 'email', 'offline_access', 'User.Read'],
  sessionCookieName: 'session',
  oauthPendingCookieName: 'oauth_pending',
  postLogoutCookieName: 'post_logout',
  sessionTtlSeconds: 12 * 60 * 60,
  oauthPendingTtlSeconds: 10 * 60,
  postLogoutTtlSeconds: 5 * 60,
  slidingRefreshThresholdSeconds: 6 * 60 * 60,
} as const
