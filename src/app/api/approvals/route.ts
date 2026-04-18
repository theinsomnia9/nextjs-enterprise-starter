import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSpan } from '@/lib/telemetry/tracing'
import { broadcastApprovalEvent } from '@/lib/approvals/sseServer'
import { createApprovalSchema } from '@/lib/approvals/schemas'

export async function POST(req: NextRequest) {
  return createSpan('approvals.submit', async () => {
    const body = await req.json()
    const parsed = createApprovalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }

    try {
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

      await broadcastApprovalEvent('request:submitted', {
        requestId: request.id,
        title: request.title,
        category: request.category,
      })

      return NextResponse.json(request, { status: 201 })
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === 'P2003' || code === 'P2025') {
        return NextResponse.json(
          {
            error: `requesterId "${parsed.data.requesterId}" does not exist. Use a seeded dev user id (e.g. dev-user-alice).`,
          },
          { status: 400 }
        )
      }
      throw err
    }
  })
}
