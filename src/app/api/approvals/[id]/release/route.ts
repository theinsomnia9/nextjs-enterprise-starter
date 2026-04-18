import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSpan } from '@/lib/telemetry/tracing'
import { broadcastApprovalEvent } from '@/lib/approvals/sseServer'
import { z } from 'zod'

const releaseSchema = z.object({
  reviewerId: z.string().min(1),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return createSpan('approvals.release', async () => {
    const body = await req.json()
    const parsed = releaseSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }

    const { id } = await params
    const existing = await prisma.approvalRequest.findUnique({
      where: { id },
      select: { assigneeId: true, status: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (existing.assigneeId !== parsed.data.reviewerId) {
      return NextResponse.json({ error: 'You are not the current reviewer' }, { status: 403 })
    }

    const updated = await prisma.approvalRequest.update({
      where: { id },
      data: {
        assigneeId: null,
        status: 'PENDING',
        lockedAt: null,
        lockExpiresAt: null,
      },
      include: {
        requester: { select: { id: true, name: true, email: true } },
      },
    })

    await broadcastApprovalEvent('request:unlocked', {
      requestId: id,
      reason: 'manual_release',
    })

    return NextResponse.json(updated)
  })
}
