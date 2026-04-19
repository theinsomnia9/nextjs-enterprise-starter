import { NextRequest, NextResponse } from 'next/server'
import { createSpan } from '@/lib/telemetry/tracing'
import { broadcastApprovalEvent } from '@/lib/approvals/sseServer'
import { createApprovalSchema } from '@/lib/approvals/schemas'
import { approvalService } from '@/services/approvalService'
import { handleApiError } from '@/lib/errors/handler'
import { validationError } from '@/lib/errors/AppError'

export async function POST(req: NextRequest) {
  return createSpan('approvals.submit', async () => {
    const body = await req.json()
    const parsed = createApprovalSchema.safeParse(body)
    if (!parsed.success) throw validationError(parsed.error.errors[0].message)

    const request = await approvalService.createApproval({
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      requester: { connect: { id: parsed.data.requesterId } },
    })

    await broadcastApprovalEvent('request:submitted', {
      requestId: request.id,
      title: request.title,
      category: request.category,
    })

    return NextResponse.json(request, { status: 201 })
  }).catch(handleApiError)
}
