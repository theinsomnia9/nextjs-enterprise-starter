// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/actor', () => ({
  getActor: vi.fn(),
}))

import { getActor } from '@/lib/auth/actor'
import { requireRole, requireAnyRole } from '@/lib/auth/requireRole'
import { Role } from '@/lib/auth/roles'

describe('requireRole', () => {
  beforeEach(() => vi.mocked(getActor).mockReset())

  it('returns the actor when it holds the required role', async () => {
    vi.mocked(getActor).mockResolvedValue({ id: 'u_1', roles: [Role.Admin] })
    const actor = await requireRole(Role.Admin)
    expect(actor.id).toBe('u_1')
  })

  it('throws FORBIDDEN when the actor lacks the required role', async () => {
    vi.mocked(getActor).mockResolvedValue({ id: 'u_1', roles: [Role.User] })
    await expect(requireRole(Role.Admin)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('passes through UNAUTHORIZED from getActor', async () => {
    const unauthorizedError = Object.freeze({ code: 'UNAUTHORIZED' })
    vi.mocked(getActor).mockRejectedValueOnce(unauthorizedError)
    let caught: any
    try {
      await requireRole(Role.Admin)
    } catch (e) {
      caught = e
    }
    expect(caught?.code).toBe('UNAUTHORIZED')
  })
})

describe('requireAnyRole', () => {
  beforeEach(() => vi.mocked(getActor).mockReset())

  it('passes if actor has any of the given roles', async () => {
    vi.mocked(getActor).mockResolvedValue({ id: 'u_1', roles: [Role.User] })
    const actor = await requireAnyRole([Role.User, Role.Admin])
    expect(actor.id).toBe('u_1')
  })

  it('throws FORBIDDEN if actor holds none of the given roles', async () => {
    vi.mocked(getActor).mockResolvedValue({ id: 'u_1', roles: [] as Role[] })
    await expect(requireAnyRole([Role.Admin])).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: expect.stringContaining('Admin'),
    })
  })
})
