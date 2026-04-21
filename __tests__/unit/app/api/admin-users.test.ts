import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { setAuthEnvStub } from '../../../helpers/authEnv'

beforeAll(() => setAuthEnvStub())

vi.mock('@/lib/auth/requireRole', () => ({
  requireRole: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
    },
  },
}))

import { requireRole } from '@/lib/auth/requireRole'
import { prisma } from '@/lib/prisma'
import { AppError, ErrorCode } from '@/lib/errors/AppError'
import { GET } from '@/app/api/admin/users/route'

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockReset()
    vi.mocked(prisma.user.findMany).mockReset()
  })

  it('returns 403 when actor is not Admin and does not touch the DB', async () => {
    vi.mocked(requireRole).mockRejectedValue(
      new AppError({
        statusCode: 403,
        code: ErrorCode.FORBIDDEN,
        message: 'Forbidden',
      })
    )
    const res = await GET()
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('FORBIDDEN')
    expect(prisma.user.findMany).not.toHaveBeenCalled()
  })

  it('returns 401 when no actor is signed in', async () => {
    vi.mocked(requireRole).mockRejectedValue(
      new AppError({
        statusCode: 401,
        code: ErrorCode.UNAUTHORIZED,
        message: 'Sign in required',
      })
    )
    const res = await GET()
    expect(res.status).toBe(401)
    expect(prisma.user.findMany).not.toHaveBeenCalled()
  })

  it('returns the user list for Admin', async () => {
    vi.mocked(requireRole).mockResolvedValue({ id: 'admin_1', roles: ['Admin'] })
    const now = new Date('2026-04-20T00:00:00.000Z')
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'u1', name: 'Alice', email: 'alice@x', image: null, createdAt: now },
    ] as never)

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.users).toHaveLength(1)
    expect(body.users[0]).toMatchObject({
      id: 'u1',
      name: 'Alice',
      email: 'alice@x',
      image: null,
    })
    expect(vi.mocked(prisma.user.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      })
    )
  })
})
