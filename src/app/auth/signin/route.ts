import { NextResponse, type NextRequest } from 'next/server'
import { randomBytes, createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { getMsalClient } from '@/lib/auth/msal'
import { authConfig } from '@/lib/auth/config'
import {
  clearPostLogoutCookieOptions,
  oauthPendingCookieOptions,
  validateReturnTo,
  OAUTH_PENDING_COOKIE,
  POST_LOGOUT_COOKIE,
} from '@/lib/auth/cookies'

export const runtime = 'nodejs'

function b64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function generatePkce(): { verifier: string; challenge: string } {
  const verifier = b64url(randomBytes(32))
  const challenge = b64url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const returnTo = validateReturnTo(url.searchParams.get('returnTo') ?? undefined)

  const store = await cookies()
  const postLogout = store.get(POST_LOGOUT_COOKIE)?.value === '1'

  const state = b64url(randomBytes(16))
  const { verifier, challenge } = generatePkce()

  const msal = getMsalClient()
  const authUrl = await msal.getAuthCodeUrl({
    scopes: [...authConfig.scopes],
    redirectUri: authConfig.redirectUri,
    state,
    codeChallenge: challenge,
    codeChallengeMethod: 'S256',
    ...(postLogout ? { prompt: 'login' } : {}),
  })

  const pending = Buffer.from(
    JSON.stringify({ state, codeVerifier: verifier, returnTo }),
    'utf8'
  ).toString('base64')

  store.set(OAUTH_PENDING_COOKIE, pending, oauthPendingCookieOptions())
  if (postLogout) {
    store.set(POST_LOGOUT_COOKIE, '', clearPostLogoutCookieOptions())
  }

  return NextResponse.redirect(authUrl, { status: 302 })
}
