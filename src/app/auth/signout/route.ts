import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { authConfig } from '@/lib/auth/config'
import { clearSessionCookieOptions, SESSION_COOKIE } from '@/lib/auth/cookies'

export const runtime = 'nodejs'

async function clearAndRedirect(): Promise<NextResponse> {
  const store = await cookies()
  store.set(SESSION_COOKIE, '', clearSessionCookieOptions())
  return NextResponse.redirect(`${authConfig.appUrl}/auth/signin`, { status: 302 })
}

export async function POST(_req: NextRequest) {
  return clearAndRedirect()
}

// Allow GET too so a plain <a href="/auth/signout"> works without a form.
export async function GET(_req: NextRequest) {
  return clearAndRedirect()
}
