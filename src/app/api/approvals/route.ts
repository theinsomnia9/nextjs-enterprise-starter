import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSpan } from '@/lib/telemetry/tracing'
import { triggerApprovalEvent } from '@/lib/approvals/pusherServer'
import { createApprovalSchema } from '@/lib/approvals/schemas'

export async function POST(req: NextRequest) {
  return createSpan('approvals.submit', async () => {
    const body = await req.json()
    const parsed = createApprovalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }

    const request = await prisma.approvalRequest.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        category: parsed.data.category,
        requesterId: parsed.data.requesterId,
      },
      include: {
        requester: { select: { id: true, name: true, email: true } },
      },
    })

    await triggerApprovalEvent('request:submitted', {
      requestId: request.id,
      title: request.title,
      category: request.category,
    })

    return NextResponse.json(request, { status: 201 })
  }) as Promise<NextResponse>
}
