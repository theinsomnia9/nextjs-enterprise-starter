import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSpan } from '@/lib/telemetry/tracing'
import { triggerApprovalEvent } from '@/lib/approvals/pusherServer'
import { z } from 'zod'

const approveSchema = z.object({
  approverId: z.string().min(1, 'Approver ID is required'),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return createSpan('approvals.approve', async () => {
    const body = await req.json()
    const parsed = approveSchema.safeParse(body)
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
        status: 'APPROVED',
        approvedById: parsed.data.approverId,
        approvedAt: new Date(),
        assigneeId: null,
        lockedAt: null,
        lockExpiresAt: null,
      },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
      },
    })

    await triggerApprovalEvent('request:approved', { requestId: id })

    return NextResponse.json(updated)
  }) as Promise<NextResponse>
}
