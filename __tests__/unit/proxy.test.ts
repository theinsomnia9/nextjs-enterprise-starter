// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import { setAuthEnvStub } from '../helpers/authEnv'

beforeAll(() => setAuthEnvStub())

function mkRequest(path: string, cookie?: string) {
  const req = new Request(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : {},
  })
  // Mimic NextRequest.cookies.get shape
  ;(req as any).nextUrl = new URL(req.url)
  ;(req as any).cookies = {
    get: (name: string) => {
      const m = (cookie ?? '').match(new RegExp(`${name}=([^;]+)`))
      return m ? { value: decodeURIComponent(m[1]) } : undefined
    },
  }
  return req as unknown as import('next/server').NextRequest
}

async function freshCookie() {
  const { encodeSession } = await import('@/lib/auth/session')
  return encodeSession({
    userId: 'u_1',
    entraOid: 'oid_1',
    roles: ['Approver'],
    name: null,
    email: null,
    photoUrl: null,
  })
}

describe('proxy', () => {
  it('redirects unauthenticated requests to /auth/signin with returnTo', async () => {
    const { proxy } = await import('@/proxy')
    const res = await proxy(mkRequest('/approvals'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/auth/signin')
    expect(res.headers.get('location')).toContain('returnTo=%2Fapprovals')
  })

  it('allows /auth/* without a session', async () => {
    const { proxy } = await import('@/proxy')
    const res = await proxy(mkRequest('/auth/signin'))
    expect(res.status).toBe(200) // NextResponse.next() yields 200
  })

  it('allows authenticated requests to pass through', async () => {
    const cookie = `session=${encodeURIComponent(await freshCookie())}`
    const { proxy } = await import('@/proxy')
    const res = await proxy(mkRequest('/approvals', cookie))
    expect(res.status).toBe(200)
  })

  it('redirects when session cookie is tampered', async () => {
    const cookie = `session=not-a-valid-jwe`
    const { proxy } = await import('@/proxy')
    const res = await proxy(mkRequest('/approvals', cookie))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/auth/signin')
  })

  it('strips a client-supplied x-auth-session header on public paths', async () => {
    const req = mkRequest('/auth/signin')
    req.headers.set('x-auth-session', '{"userId":"forged","roles":["Admin"]}')
    const { proxy } = await import('@/proxy')
    const res = await proxy(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('x-middleware-override-headers') ?? '').toContain('x-auth-session')
    expect(res.headers.get('x-middleware-request-x-auth-session')).toBe('')
  })

  it('forwards the verified session payload via x-auth-session on authenticated requests', async () => {
    const cookie = `session=${encodeURIComponent(await freshCookie())}`
    const { proxy } = await import('@/proxy')
    const res = await proxy(mkRequest('/approvals', cookie))
    expect(res.status).toBe(200)
    const forwarded = res.headers.get('x-middleware-request-x-auth-session') ?? ''
    expect(forwarded).toBeTruthy()
    const parsed = JSON.parse(forwarded)
    expect(parsed.userId).toBe('u_1')
    expect(parsed.roles).toEqual(['Approver'])
  })
})
