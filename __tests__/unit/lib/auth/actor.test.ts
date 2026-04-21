// @vitest-environment node
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { setAuthEnvStub } from '../../../helpers/authEnv'

beforeAll(() => setAuthEnvStub())

const mockStore = { get: vi.fn(), set: vi.fn(), delete: vi.fn() }
const mockHeaders = { get: vi.fn<(name: string) => string | null>() }

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockStore),
  headers: vi.fn(async () => mockHeaders),
}))

async function encodeFresh(overrides: Record<string, unknown> = {}) {
  const { encodeSession } = await import('@/lib/auth/session')
  return encodeSession({
    userId: 'u_1',
    entraOid: 'oid_1',
    roles: ['User'],
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
    mockHeaders.get.mockReset()
    mockHeaders.get.mockReturnValue(null)
  })

  it('returns { id, roles } when the session cookie is valid', async () => {
    const cookie = await encodeFresh()
    mockStore.get.mockReturnValue({ value: cookie })
    const { getActor } = await import('@/lib/auth/actor')
    const actor = await getActor()
    expect(actor).toEqual({ id: 'u_1', roles: ['User'] })
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
        roles: ['User'],
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
      { userId: 'u_1', entraOid: 'oid_1', roles: ['User'], name: null, email: null, photoUrl: null },
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
    mockHeaders.get.mockReset()
    mockHeaders.get.mockReturnValue(null)
  })

  it('returns the id string', async () => {
    const cookie = await encodeFresh()
    mockStore.get.mockReturnValue({ value: cookie })
    const { getActorId } = await import('@/lib/auth/actor')
    await expect(getActorId()).resolves.toBe('u_1')
  })
})

describe('readSession middleware-forwarded header', () => {
  beforeEach(() => {
    mockStore.get.mockReset()
    mockStore.set.mockReset()
    mockHeaders.get.mockReset()
  })

  it('uses the forwarded payload without decrypting the cookie', async () => {
    const now = Math.floor(Date.now() / 1000)
    const payload = {
      userId: 'u_hdr',
      entraOid: 'oid_hdr',
      roles: ['Admin'],
      name: null,
      email: null,
      photoUrl: null,
      iat: now,
      exp: now + 12 * 60 * 60,
    }
    mockHeaders.get.mockImplementation((n: string) =>
      n === 'x-auth-session' ? JSON.stringify(payload) : null
    )
    // Cookie is deliberately garbage — header path must win.
    mockStore.get.mockReturnValue({ value: 'garbage' })
    const { getActor } = await import('@/lib/auth/actor')
    await expect(getActor()).resolves.toEqual({ id: 'u_hdr', roles: ['Admin'] })
  })

  it('falls back to cookie decrypt when the forwarded header is malformed', async () => {
    const cookie = await encodeFresh({ userId: 'u_fb', roles: ['User'] })
    mockHeaders.get.mockImplementation((n: string) =>
      n === 'x-auth-session' ? 'not-json' : null
    )
    mockStore.get.mockReturnValue({ value: cookie })
    const { getActor } = await import('@/lib/auth/actor')
    await expect(getActor()).resolves.toEqual({ id: 'u_fb', roles: ['User'] })
  })

  it('falls back when the forwarded header is missing required fields', async () => {
    const cookie = await encodeFresh({ userId: 'u_partial' })
    mockHeaders.get.mockImplementation((n: string) =>
      n === 'x-auth-session' ? JSON.stringify({ userId: 'only-user' }) : null
    )
    mockStore.get.mockReturnValue({ value: cookie })
    const { getActor } = await import('@/lib/auth/actor')
    await expect(getActor()).resolves.toMatchObject({ id: 'u_partial' })
  })
})
