import { NextResponse, type NextRequest } from 'next/server'
import { decodeSession } from '@/lib/auth/session'
import { authConfig } from '@/lib/auth/config'

// Edge runtime is the default for middleware in Next.js; keep it so.
export const config = {
  // Match everything except Next.js internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)'],
}

function isPublicPath(pathname: string): boolean {
  return pathname === '/auth/signin' ||
    pathname === '/auth/callback' ||
    pathname === '/auth/signout' ||
    pathname.startsWith('/auth/unauthorized') ||
    pathname === '/auth/signin/' // trailing-slash tolerance
}

function redirectToSignin(req: NextRequest, extra: Record<string, string> = {}): NextResponse {
  const url = new URL('/auth/signin', req.nextUrl.origin)
  const returnTo = req.nextUrl.pathname + req.nextUrl.search
  if (returnTo && returnTo !== '/') url.searchParams.set('returnTo', returnTo)
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v)
  return NextResponse.redirect(url, { status: 307 })
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl
  if (isPublicPath(pathname)) return NextResponse.next()

  const cookie = req.cookies.get(authConfig.sessionCookieName)?.value
  if (!cookie) return redirectToSignin(req)

  try {
    await decodeSession(cookie)
    return NextResponse.next()
  } catch {
    return redirectToSignin(req, { error: 'invalid_session' })
  }
}
