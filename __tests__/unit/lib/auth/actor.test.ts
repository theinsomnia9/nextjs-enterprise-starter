// @vitest-environment node
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

beforeAll(() => {
  process.env.AUTH_SESSION_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef'
  process.env.APP_URL = 'http://localhost:3000'
  process.env.AZURE_AD_CLIENT_ID = 'x'
  process.env.AZURE_AD_CLIENT_SECRET = 'x'
  process.env.AZURE_AD_TENANT_ID = 'x'
})

const mockStore = { get: vi.fn(), set: vi.fn(), delete: vi.fn() }

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockStore),
}))

async function encodeFresh(overrides: Record<string, unknown> = {}) {
  const { encodeSession } = await import('@/lib/auth/session')
  return encodeSession({
    userId: 'u_1',
    entraOid: 'oid_1',
    roles: ['Approver'],
    name: 'Alice',
    email: 'a@x.com',
    photoUrl: null,
    ...overrides,
  } as never)
}

describe('getActor', () => {
  beforeEach(() => {
    mockStore.get.mockReset()
    mockStore.set.mockReset()
    mockStore.delete.mockReset()
  })

  it('returns { id, roles } when the session cookie is valid', async () => {
    const cookie = await encodeFresh()
    mockStore.get.mockReturnValue({ value: cookie })
    const { getActor } = await import('@/lib/auth/actor')
    const actor = await getActor()
    expect(actor).toEqual({ id: 'u_1', roles: ['Approver'] })
  })

  it('throws UNAUTHORIZED when no session cookie', async () => {
    mockStore.get.mockReturnValue(undefined)
    const { getActor } = await import('@/lib/auth/actor')
    await expect(getActor()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('throws UNAUTHORIZED on tampered cookie', async () => {
    mockStore.get.mockReturnValue({ value: 'not-a-valid-jwe' })
    const { getActor } = await import('@/lib/auth/actor')
    await expect(getActor()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('does not try to refresh if session is fresh (<6h old)', async () => {
    const cookie = await encodeFresh()
    mockStore.get.mockReturnValue({ value: cookie })
    const { getActor } = await import('@/lib/auth/actor')
    await getActor()
    expect(mockStore.set).not.toHaveBeenCalled()
  })

  it('refreshes the cookie when session is older than 6h', async () => {
    const { encodeSession } = await import('@/lib/auth/session')
    const now = Math.floor(Date.now() / 1000)
    // issue a cookie that says iat was 7 hours ago; still valid (< 12h)
    const cookie = await encodeSession(
      {
        userId: 'u_1',
        entraOid: 'oid_1',
        roles: ['Approver'],
        name: 'Alice',
        email: 'a@x.com',
        photoUrl: null,
      },
      { now: now - 7 * 60 * 60, ttlSeconds: 12 * 60 * 60 }
    )
    mockStore.get.mockReturnValue({ value: cookie })
    const { getActor } = await import('@/lib/auth/actor')
    await getActor()
    expect(mockStore.set).toHaveBeenCalledWith('session', expect.any(String), expect.objectContaining({ httpOnly: true }))
  })

  it('silently swallows cookie set failures (server component context)', async () => {
    const { encodeSession } = await import('@/lib/auth/session')
    const now = Math.floor(Date.now() / 1000)
    const cookie = await encodeSession(
      { userId: 'u_1', entraOid: 'oid_1', roles: ['Approver'], name: null, email: null, photoUrl: null },
      { now: now - 7 * 60 * 60 }
    )
    mockStore.get.mockReturnValue({ value: cookie })
    mockStore.set.mockImplementation(() => {
      throw new Error('Cookies can only be modified in a Server Action or Route Handler.')
    })
    const { getActor } = await import('@/lib/auth/actor')
    await expect(getActor()).resolves.toMatchObject({ id: 'u_1' })
  })
})

describe('getActorId (back-compat shim)', () => {
  beforeEach(() => {
    mockStore.get.mockReset()
    mockStore.set.mockReset()
  })

  it('returns the id string', async () => {
    const cookie = await encodeFresh()
    mockStore.get.mockReturnValue({ value: cookie })
    const { getActorId } = await import('@/lib/auth/actor')
    await expect(getActorId()).resolves.toBe('u_1')
  })
})
