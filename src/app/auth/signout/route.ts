import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { authConfig } from '@/lib/auth/config'
import {
  clearSessionCookieOptions,
  postLogoutCookieOptions,
  POST_LOGOUT_COOKIE,
  SESSION_COOKIE,
} from '@/lib/auth/cookies'

export const runtime = 'nodejs'

function endSessionUrl(): string {
  const params = new URLSearchParams({
    post_logout_redirect_uri: `${authConfig.appUrl}/auth/signin`,
    client_id: authConfig.clientId,
  })
  return `${authConfig.authorityUrl}/oauth2/v2.0/logout?${params.toString()}`
}

async function clearAndRedirect(): Promise<NextResponse> {
  const store = await cookies()
  store.set(SESSION_COOKIE, '', clearSessionCookieOptions())
  store.set(POST_LOGOUT_COOKIE, '1', postLogoutCookieOptions())
  return NextResponse.redirect(endSessionUrl(), { status: 302 })
}

export async function POST(_req: NextRequest) {
  return clearAndRedirect()
}

// Allow GET too so a plain <a href="/auth/signout"> works without a form.
export async function GET(_req: NextRequest) {
  return clearAndRedirect()
}
