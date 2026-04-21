import { describe, it, expect, beforeEach, vi } from 'vitest'

// The route's authZ layer is unit-tested. Here we bypass requireRole so the
// integration test focuses on the real Prisma round-trip and JSON shape.
vi.mock('@/lib/auth/requireRole', () => ({
  requireRole: vi.fn().mockResolvedValue({ id: 'admin-test', roles: ['Admin'] }),
}))

import { prisma } from '@/lib/prisma'
import { GET } from '@/app/api/admin/users/route'

const EMAIL_DOMAIN = '@admin-users-it.test'

describe('GET /api/admin/users (integration)', () => {
  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } })
  })

  it('returns users from the DB ordered by createdAt desc', async () => {
    await prisma.user.create({
      data: {
        entraOid: 'it-admin-users-oid-1',
        email: `alpha${EMAIL_DOMAIN}`,
        name: 'Alpha',
      },
    })
    await new Promise((r) => setTimeout(r, 10))
    await prisma.user.create({
      data: {
        entraOid: 'it-admin-users-oid-2',
        email: `beta${EMAIL_DOMAIN}`,
        name: 'Beta',
      },
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      users: { id: string; name: string | null; email: string; image: string | null; createdAt: string }[]
    }

    const seeded = body.users.filter((u) => u.email.endsWith(EMAIL_DOMAIN))
    expect(seeded).toHaveLength(2)
    expect(seeded[0].email).toBe(`beta${EMAIL_DOMAIN}`)
    expect(seeded[1].email).toBe(`alpha${EMAIL_DOMAIN}`)
    // Each row carries only the fields the route selected.
    expect(Object.keys(seeded[0]).sort()).toEqual(
      ['createdAt', 'email', 'id', 'image', 'name'].sort()
    )
  })
})
