import { http, HttpResponse } from 'msw'

export type MockTokenOverrides = {
  roles?: string[] | undefined
  oid?: string
  name?: string
  email?: string
  status?: number
  body?: Record<string, unknown>
}

export function buildIdToken(claims: Record<string, unknown>): string {
  // Minimal unsigned JWT — header.payload.signature (signature is never verified
  // by MSAL in our integration because we mock the token endpoint entirely).
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return `${header}.${payload}.`
}

export function entraHandlers(overrides: MockTokenOverrides = {}) {
  const claims = {
    oid: overrides.oid ?? 'oid-alice',
    name: overrides.name ?? 'Alice Test',
    preferred_username: overrides.email ?? 'alice@test.local',
    ...(overrides.roles !== undefined && { roles: overrides.roles }),
  }
  return [
    http.post(`https://login.microsoftonline.com/*/oauth2/v2.0/token`, async () => {
      if (overrides.status && overrides.status >= 400) {
        return HttpResponse.json(overrides.body ?? { error: 'invalid_grant' }, {
          status: overrides.status,
        })
      }
      return HttpResponse.json({
        token_type: 'Bearer',
        scope: 'openid profile User.Read',
        expires_in: 3600,
        access_token: 'fake-access-token',
        refresh_token: 'fake-refresh-token',
        id_token: buildIdToken(claims),
      })
    }),
    http.get('https://graph.microsoft.com/v1.0/me/photos/*', () =>
      HttpResponse.arrayBuffer(new Uint8Array([0xff, 0xd8, 0xff]).buffer, {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      })
    ),
  ]
}
