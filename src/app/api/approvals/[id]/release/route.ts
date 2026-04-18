import { NextRequest, NextResponse } from 'next/server'
import { createSpan } from '@/lib/telemetry/tracing'
import { broadcastApprovalEvent } from '@/lib/approvals/sseServer'
import { getActorId } from '@/lib/auth/actor'
import { approvalService } from '@/services/approvalService'
import { handleApiError } from '@/lib/errors/handler'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return createSpan('approvals.release', async () => {
    const { id } = await params
    const reviewerId = await getActorId()
    const updated = await approvalService.release(id, reviewerId)
    await broadcastApprovalEvent('request:unlocked', { requestId: id, reason: 'manual_release' })
    return NextResponse.json(updated)
  }).catch(handleApiError)
}
