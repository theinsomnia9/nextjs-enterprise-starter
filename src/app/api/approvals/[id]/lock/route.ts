import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSpan } from '@/lib/telemetry/tracing'
import { broadcastApprovalEvent } from '@/lib/approvals/sseServer'
import { z } from 'zod'

const lockSchema = z.object({
  reviewerId: z.string().min(1, 'Reviewer ID is required'),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return createSpan('approvals.lock', async () => {
    const body = await req.json()
    const parsed = lockSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }

    const { id } = params
    const { reviewerId } = parsed.data

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.approvalRequest.findUnique({
        where: { id },
        select: { status: true, lockExpiresAt: true, assigneeId: true, category: true },
      })

      if (!existing) {
        throw Object.assign(new Error('Request not found'), { statusCode: 404 })
      }

      if (
        existing.lockExpiresAt &&
        existing.lockExpiresAt > new Date() &&
        existing.assigneeId !== reviewerId
      ) {
        throw Object.assign(new Error('Request is locked by another reviewer'), {
          statusCode: 409,
        })
      }

      if (existing.status === 'APPROVED' || existing.status === 'REJECTED') {
        throw Object.assign(new Error('Request is already resolved'), { statusCode: 409 })
      }

      const config = await tx.priorityConfig.findUnique({ where: { category: existing.category } })
      const lockMinutes = config?.lockTimeoutMinutes ?? 5
      const lockExpiresAt = new Date(Date.now() + lockMinutes * 60 * 1000)

      const result = await tx.approvalRequest.update({
        where: { id },
        data: {
          assigneeId: reviewerId,
          status: 'REVIEWING',
          lockedAt: new Date(),
          lockExpiresAt,
        },
        include: {
          requester: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
        },
      })

      return { ...result, _lockExpiresAt: lockExpiresAt }
    })

    await broadcastApprovalEvent('request:locked', {
      requestId: id,
      reviewerId,
      expiresAt: updated._lockExpiresAt.toISOString(),
    })

    return NextResponse.json(updated)
  }).catch((err: Error & { statusCode?: number }) => {
    const status = err.statusCode ?? 500
    return NextResponse.json({ error: err.message }, { status })
  })
}
