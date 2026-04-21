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

const END_SESSION_URL = `${authConfig.authorityUrl}/oauth2/v2.0/logout?${new URLSearchParams(
  {
    post_logout_redirect_uri: `${authConfig.appUrl}/auth/signin`,
    client_id: authConfig.clientId,
  }
).toString()}`

async function handler(_req: NextRequest): Promise<NextResponse> {
  const store = await cookies()
  store.set(SESSION_COOKIE, '', clearSessionCookieOptions())
  store.set(POST_LOGOUT_COOKIE, '1', postLogoutCookieOptions())
  return NextResponse.redirect(END_SESSION_URL, { status: 302 })
}

export { handler as GET, handler as POST }
