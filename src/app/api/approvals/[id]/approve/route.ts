import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSpan } from '@/lib/telemetry/tracing'
import { triggerApprovalEvent } from '@/lib/approvals/sseServer'
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
    const { approverId } = parsed.data

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
      if (existing.assigneeId && existing.assigneeId !== approverId) {
        throw Object.assign(new Error('Request is locked by another reviewer'), { statusCode: 403 })
      }

      return tx.approvalRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById: approverId,
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
    })

    await triggerApprovalEvent('request:approved', { requestId: id })

    return NextResponse.json(updated)
  }).catch((err: Error & { statusCode?: number }) => {
    const status = err.statusCode ?? 500
    return NextResponse.json({ error: err.message }, { status })
  }) as Promise<NextResponse>
}
