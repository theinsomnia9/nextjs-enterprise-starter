import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

const { getServerSession } = await import('next-auth')

describe('getActor', () => {
  const originalEnv = process.env.NODE_ENV

  beforeEach(() => {
    vi.mocked(getServerSession).mockReset()
  })

  afterEach(() => {
    // @ts-expect-error re-assigning NODE_ENV in tests
    process.env.NODE_ENV = originalEnv
  })

  it('returns session user id when a session exists', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user-42', name: 'Alice', email: 'a@example.com' },
    } as never)
    const { getActor } = await import('@/lib/auth/actor')
    const actor = await getActor()
    expect(actor).toEqual({ id: 'user-42' })
  })

  it('falls back to dev user id when no session in non-production', async () => {
    // @ts-expect-error re-assigning NODE_ENV in tests
    process.env.NODE_ENV = 'development'
    vi.mocked(getServerSession).mockResolvedValue(null)
    vi.resetModules()
    const { getActor, DEV_ACTOR_ID } = await import('@/lib/auth/actor')
    const actor = await getActor()
    expect(actor).toEqual({ id: DEV_ACTOR_ID })
  })

  it('throws UNAUTHORIZED when no session in production', async () => {
    // @ts-expect-error re-assigning NODE_ENV in tests
    process.env.NODE_ENV = 'production'
    vi.mocked(getServerSession).mockResolvedValue(null)
    vi.resetModules()
    const { getActor } = await import('@/lib/auth/actor')
    await expect(getActor()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })
})

describe('getActorId (back-compat shim)', () => {
  it('returns the id string from getActor', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user-99' },
    } as never)
    vi.resetModules()
    const { getActorId } = await import('@/lib/auth/actor')
    await expect(getActorId()).resolves.toBe('user-99')
  })
})
