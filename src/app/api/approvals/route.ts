import { NextResponse } from 'next/server'
import { withApi } from '@/lib/api/withApi'
import { broadcastApprovalEvent } from '@/lib/approvals/sseServer'
import { createApprovalSchema } from '@/lib/approvals/schemas'
import { approvalService } from '@/services/approvalService'
import { validationError } from '@/lib/errors/AppError'

export const POST = withApi('approvals.submit', async (req) => {
  const body = await req.json()
  const parsed = createApprovalSchema.safeParse(body)
  if (!parsed.success) throw validationError(parsed.error.issues[0].message)

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
})
