import { describe, it, expect, afterEach } from 'vitest'

describe('getActor', () => {
  const originalEnv = process.env.NODE_ENV

  afterEach(() => {
    // @ts-expect-error re-assigning NODE_ENV in tests
    process.env.NODE_ENV = originalEnv
  })

  it('returns the dev actor id in non-production', async () => {
    // @ts-expect-error re-assigning NODE_ENV in tests
    process.env.NODE_ENV = 'development'
    const { getActor, DEV_ACTOR_ID } = await import('@/lib/auth/actor')
    const actor = await getActor()
    expect(actor).toEqual({ id: DEV_ACTOR_ID })
  })

  it('throws UNAUTHORIZED in production', async () => {
    // @ts-expect-error re-assigning NODE_ENV in tests
    process.env.NODE_ENV = 'production'
    const { getActor } = await import('@/lib/auth/actor')
    await expect(getActor()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})

describe('getActorId (back-compat shim)', () => {
  const originalEnv = process.env.NODE_ENV

  afterEach(() => {
    // @ts-expect-error re-assigning NODE_ENV in tests
    process.env.NODE_ENV = originalEnv
  })

  it('returns the dev actor id string in non-production', async () => {
    // @ts-expect-error re-assigning NODE_ENV in tests
    process.env.NODE_ENV = 'development'
    const { getActorId, DEV_ACTOR_ID } = await import('@/lib/auth/actor')
    await expect(getActorId()).resolves.toBe(DEV_ACTOR_ID)
  })
})
