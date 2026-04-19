import { NextResponse, type NextRequest } from 'next/server'
import { decodeSession } from '@/lib/auth/session'
import { authConfig } from '@/lib/auth/config'
import { SESSION_HEADER } from '@/lib/auth/sessionHeader'

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

// Build forward headers with any client-supplied SESSION_HEADER overridden.
// Next.js only strips client values for headers that appear in the
// x-middleware-override-headers list, so we must `set` (not `delete`) to
// guarantee the downstream request cannot see a forged value.
function scrubbedRequestHeaders(req: NextRequest): Headers {
  const h = new Headers(req.headers)
  h.set(SESSION_HEADER, '')
  return h
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl
  const forwardHeaders = scrubbedRequestHeaders(req)

  if (isPublicPath(pathname)) {
    return NextResponse.next({ request: { headers: forwardHeaders } })
  }

  const cookie = req.cookies.get(authConfig.sessionCookieName)?.value
  if (!cookie) return redirectToSignin(req)

  try {
    const session = await decodeSession(cookie)
    // Hand the already-verified payload to the Node runtime so getActor()
    // and getSessionForClient() can skip a redundant JWE decrypt per request.
    forwardHeaders.set(SESSION_HEADER, JSON.stringify(session))
    return NextResponse.next({ request: { headers: forwardHeaders } })
  } catch {
    return redirectToSignin(req, { error: 'invalid_session' })
  }
}
