import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { setupServer } from 'msw/node'
import { entraHandlers, buildIdToken } from '../../mocks/handlers/entra'
import { prisma } from '@/lib/prisma'

// Bypass MSAL's real PKCE verifier check by mocking acquireTokenByCode.
// We still exercise the rest of the callback pipeline (cookie set, user upsert, session encode).
import { vi } from 'vitest'

vi.mock('@/lib/auth/msal', () => {
  const acquireTokenByCode = vi.fn()
  return {
    getMsalClient: () => ({ acquireTokenByCode }),
    __mocks: { acquireTokenByCode },
  }
})

const server = setupServer(...entraHandlers())

beforeAll(() => server.listen())
afterAll(() => server.close())

beforeEach(async () => {
  server.resetHandlers(...entraHandlers())
  await prisma.user.deleteMany({ where: { entraOid: { startsWith: 'test-oid-' } } })
})

function fakePendingCookie(state: string, codeVerifier = 'verifier', returnTo: string | null = null) {
  return Buffer.from(JSON.stringify({ state, codeVerifier, returnTo }), 'utf8').toString('base64')
}

describe('GET /auth/callback', () => {
  it('happy path: exchanges code, upserts user, sets session cookie, redirects home', async () => {
    const msal = await import('@/lib/auth/msal')
    // @ts-expect-error __mocks is our backdoor
    msal.__mocks.acquireTokenByCode.mockResolvedValue({
      idToken: buildIdToken({ oid: 'test-oid-1', name: 'Alice', preferred_username: 'a@test.local', roles: ['User'] }),
      accessToken: 'fake-access-token',
      idTokenClaims: {
        oid: 'test-oid-1',
        name: 'Alice',
        preferred_username: 'a@test.local',
        roles: ['User'],
      },
    })

    const { GET } = await import('@/app/auth/callback/route')
    const req = new Request('http://localhost:3000/auth/callback?code=abc&state=xyz', {
      headers: { cookie: `oauth_pending=${fakePendingCookie('xyz')}` },
    })
    const res = await GET(req as never)

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/')
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('session=')
    expect(setCookie.toLowerCase()).toContain('httponly')

    const user = await prisma.user.findUnique({ where: { entraOid: 'test-oid-1' } })
    expect(user).not.toBeNull()
    expect(user?.email).toBe('a@test.local')
  })

  it('state mismatch: redirects to /auth/signin with error, no user created, no cookie', async () => {
    const { GET } = await import('@/app/auth/callback/route')
    const req = new Request('http://localhost:3000/auth/callback?code=abc&state=NOT_MATCHING', {
      headers: { cookie: `oauth_pending=${fakePendingCookie('xyz')}` },
    })
    const res = await GET(req as never)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('/auth/signin?error=state_mismatch')
    const user = await prisma.user.findFirst({ where: { entraOid: { startsWith: 'test-oid-' } } })
    expect(user).toBeNull()
  })

  it('no role claim → session contains [User]', async () => {
    const msal = await import('@/lib/auth/msal')
    // @ts-expect-error __mocks
    msal.__mocks.acquireTokenByCode.mockResolvedValue({
      accessToken: 'fake-access-token',
      idTokenClaims: {
        oid: 'test-oid-2',
        name: 'Bob',
        preferred_username: 'b@test.local',
      },
    })
    const { GET } = await import('@/app/auth/callback/route')
    const req = new Request('http://localhost:3000/auth/callback?code=abc&state=xyz', {
      headers: { cookie: `oauth_pending=${fakePendingCookie('xyz')}` },
    })
    const res = await GET(req as never)
    expect(res.status).toBe(302)

    const sessionCookie = (res.headers.get('set-cookie') ?? '').match(/session=([^;]+)/)?.[1] ?? ''
    const { decodeSession } = await import('@/lib/auth/session')
    const payload = await decodeSession(decodeURIComponent(sessionCookie))
    expect(payload.roles).toEqual(['User'])
  })
})
