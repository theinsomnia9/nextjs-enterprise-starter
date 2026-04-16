import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSpan } from '@/lib/telemetry/tracing'
import { triggerApprovalEvent } from '@/lib/approvals/pusherServer'
import { rejectApprovalSchema } from '@/lib/approvals/schemas'
import { z } from 'zod'

const rejectBodySchema = rejectApprovalSchema.extend({
  rejectorId: z.string().min(1, 'Rejector ID is required'),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return createSpan('approvals.reject', async () => {
    const body = await req.json()
    const parsed = rejectBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }

    const { id } = params
    const existing = await prisma.approvalRequest.findUnique({
      where: { id },
      select: { status: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (existing.status === 'APPROVED' || existing.status === 'REJECTED') {
      return NextResponse.json({ error: 'Request is already resolved' }, { status: 409 })
    }

    const updated = await prisma.approvalRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: parsed.data.reason,
        rejectedAt: new Date(),
        assigneeId: null,
        lockedAt: null,
        lockExpiresAt: null,
      },
      include: {
        requester: { select: { id: true, name: true, email: true } },
      },
    })

    await triggerApprovalEvent('request:rejected', {
      requestId: id,
      reason: parsed.data.reason,
    })

    return NextResponse.json(updated)
  }) as Promise<NextResponse>
}
