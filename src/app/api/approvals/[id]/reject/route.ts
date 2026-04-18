import { NextRequest, NextResponse } from 'next/server'
import { createSpan } from '@/lib/telemetry/tracing'
import { broadcastApprovalEvent } from '@/lib/approvals/sseServer'
import { getActorId } from '@/lib/auth/actor'
import { approvalService } from '@/services/approvalService'
import { handleApiError } from '@/lib/errors/handler'
import { validationError } from '@/lib/errors/AppError'
import { z } from 'zod'

const rejectBodySchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return createSpan('approvals.reject', async () => {
    const body = await req.json()
    const parsed = rejectBodySchema.safeParse(body)
    if (!parsed.success) throw validationError(parsed.error.errors[0].message)

    const { id } = await params
    const rejectorId = await getActorId()
    const updated = await approvalService.reject(id, rejectorId, parsed.data.reason)
    await broadcastApprovalEvent('request:rejected', { requestId: id, reason: parsed.data.reason })
    return NextResponse.json(updated)
  }).catch(handleApiError)
}
