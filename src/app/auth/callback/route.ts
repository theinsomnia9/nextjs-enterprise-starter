import { NextResponse, type NextRequest } from 'next/server'
import { getMsalClient } from '@/lib/auth/msal'
import { authConfig } from '@/lib/auth/config'
import { parseRolesClaim } from '@/lib/auth/roles'
import { encodeSession } from '@/lib/auth/session'
import { fetchUserPhoto } from '@/lib/auth/graph'
import {
  clearOauthPendingCookieOptions,
  clearSessionCookieOptions,
  sessionCookieOptions,
  validateReturnTo,
  OAUTH_PENDING_COOKIE,
  SESSION_COOKIE,
} from '@/lib/auth/cookies'
import { prisma } from '@/lib/prisma'
import { createSpan } from '@/lib/telemetry/tracing'

export const runtime = 'nodejs'

type PendingOauth = { state: string; codeVerifier: string; returnTo: string | null }

function redirect(location: string): NextResponse {
  // Use NextResponse with a manual Location header so relative paths like '/' work
  // correctly in both production (Next.js) and test (plain node) environments.
  const res = new NextResponse(null, { status: 302 })
  res.headers.set('Location', location)
  return res
}

function parseCookieHeader(header: string | null): Record<string, string> {
  if (!header) return {}
  return Object.fromEntries(
    header.split(';').map((part) => {
      const idx = part.indexOf('=')
      if (idx === -1) return [part.trim(), '']
      return [part.slice(0, idx).trim(), part.slice(idx + 1).trim()]
    })
  )
}

function readPendingFromRequest(req: NextRequest): PendingOauth | null {
  // Try NextRequest cookies API first (production), fall back to raw header (test context)
  let raw: string | undefined
  if (req.cookies && typeof req.cookies.get === 'function') {
    raw = req.cookies.get(OAUTH_PENDING_COOKIE)?.value
  } else {
    const cookieHeader = (req as Request).headers.get('cookie')
    raw = parseCookieHeader(cookieHeader)[OAUTH_PENDING_COOKIE]
  }
  if (!raw) return null
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as PendingOauth
  } catch {
    return null
  }
}

function clearPendingOnResponse(res: NextResponse): void {
  const opts = clearOauthPendingCookieOptions()
  res.cookies.set(OAUTH_PENDING_COOKIE, '', opts)
}

export async function GET(req: NextRequest) {
  return createSpan('auth.callback', async (span) => {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    // Entra-surfaced error (user cancelled, admin hasn't consented, etc.)
    if (error) {
      span.setAttribute('error.code', error)
      const res = redirect(`${authConfig.appUrl}/auth/unauthorized?reason=entra&code=${encodeURIComponent(error)}`)
      clearPendingOnResponse(res)
      return res
    }

    const pending = readPendingFromRequest(req)
    if (!pending || !state || pending.state !== state || !code) {
      span.setAttribute('error.reason', 'state_mismatch')
      const res = redirect(`${authConfig.appUrl}/auth/signin?error=state_mismatch`)
      clearPendingOnResponse(res)
      return res
    }

    let tokenResult
    try {
      tokenResult = await getMsalClient().acquireTokenByCode({
        code,
        scopes: [...authConfig.scopes],
        redirectUri: authConfig.redirectUri,
        codeVerifier: pending.codeVerifier,
      })
    } catch (err) {
      span.setAttribute('error.reason', 'token_exchange')
      span.setAttribute('error.code', (err as { errorCode?: string }).errorCode ?? 'unknown')
      const res = redirect(`${authConfig.appUrl}/auth/unauthorized?reason=token_exchange`)
      clearPendingOnResponse(res)
      return res
    }
    if (!tokenResult) {
      const res = redirect(`${authConfig.appUrl}/auth/unauthorized?reason=token_exchange`)
      clearPendingOnResponse(res)
      return res
    }

    const claims = tokenResult.idTokenClaims as {
      oid?: string
      name?: string
      preferred_username?: string
      roles?: unknown
    }
    const entraOid = claims.oid
    const email = claims.preferred_username
    if (!entraOid || !email) {
      const res = redirect(`${authConfig.appUrl}/auth/unauthorized?reason=provisioning`)
      clearPendingOnResponse(res)
      return res
    }

    const name = claims.name ?? null
    const roles = parseRolesClaim(claims.roles)

    let user
    try {
      user = await prisma.user.upsert({
        where: { entraOid },
        create: { entraOid, name, email, image: null },
        update: { name, email },
      })
    } catch (err) {
      span.setAttribute('error.reason', 'provisioning')
      console.error('[auth/callback] user upsert failed', err)
      const res = redirect(`${authConfig.appUrl}/auth/unauthorized?reason=provisioning`)
      clearPendingOnResponse(res)
      return res
    }

    let photoUrl = user.image
    if (!photoUrl && tokenResult.accessToken) {
      photoUrl = await fetchUserPhoto(tokenResult.accessToken)
      if (photoUrl) {
        await prisma.user
          .update({ where: { id: user.id }, data: { image: photoUrl } })
          .catch((err) => console.warn('[auth/callback] persist photo failed', err))
      }
    }

    span.setAttribute('actor.id', user.id)
    span.setAttribute('actor.entraOid', entraOid)

    const sessionCookie = await encodeSession({
      userId: user.id,
      entraOid,
      roles,
      name,
      email,
      photoUrl,
    })

    const returnTo = validateReturnTo(pending.returnTo) ?? '/dashboard'
    const res = redirect(returnTo)

    // Set session cookie on the response
    res.cookies.set(SESSION_COOKIE, sessionCookie, sessionCookieOptions())
    // Clear the pending oauth cookie
    clearPendingOnResponse(res)

    return res
  })
}

// Unused clear helper retained in case of future federated-logout expansion.
void clearSessionCookieOptions
