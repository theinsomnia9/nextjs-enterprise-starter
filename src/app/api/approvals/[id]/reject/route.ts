import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSpan } from '@/lib/telemetry/tracing'
import { broadcastApprovalEvent } from '@/lib/approvals/sseServer'
import { rejectApprovalSchema } from '@/lib/approvals/schemas'
import { z } from 'zod'

const rejectBodySchema = rejectApprovalSchema.extend({
  rejectorId: z.string().min(1, 'Rejector ID is required'),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return createSpan('approvals.reject', async () => {
    const body = await req.json()
    const parsed = rejectBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }

    const { id } = await params
    const { rejectorId, reason } = parsed.data

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.approvalRequest.findUnique({
        where: { id },
        select: { status: true, assigneeId: true },
      })

      if (!existing) {
        throw Object.assign(new Error('Request not found'), { statusCode: 404 })
      }
      if (existing.status === 'APPROVED' || existing.status === 'REJECTED') {
        throw Object.assign(new Error('Request is already resolved'), { statusCode: 409 })
      }
      if (existing.assigneeId && existing.assigneeId !== rejectorId) {
        throw Object.assign(new Error('Request is locked by another reviewer'), { statusCode: 403 })
      }

      return tx.approvalRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason: reason,
          rejectedAt: new Date(),
          assigneeId: null,
          lockedAt: null,
          lockExpiresAt: null,
        },
        include: {
          requester: { select: { id: true, name: true, email: true } },
        },
      })
    })

    await broadcastApprovalEvent('request:rejected', { requestId: id, reason })

    return NextResponse.json(updated)
  }).catch((err: Error & { statusCode?: number }) => {
    const status = err.statusCode ?? 500
    return NextResponse.json({ error: err.message }, { status })
  })
}
