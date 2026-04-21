import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { Role } from '@/lib/auth/roles'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/errors/handler'
import { createSpan } from '@/lib/telemetry/tracing'

export const runtime = 'nodejs'

export async function GET() {
  try {
    return await createSpan('api.admin.users.list', async (span) => {
      const actor = await requireRole(Role.Admin)
      span.setAttribute('actor.id', actor.id)

      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          createdAt: true,
        },
      })
      span.setAttribute('users.count', users.length)

      return NextResponse.json({ users })
    })
  } catch (err) {
    return handleApiError(err)
  }
}
