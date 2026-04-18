import { NextRequest, NextResponse } from 'next/server'
import { createSpan } from '@/lib/telemetry/tracing'
import { broadcastApprovalEvent } from '@/lib/approvals/sseServer'
import { getActorId } from '@/lib/auth/actor'
import { approvalService } from '@/services/approvalService'
import { handleApiError } from '@/lib/errors/handler'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return createSpan('approvals.approve', async () => {
    const { id } = await params
    const approverId = await getActorId()
    const updated = await approvalService.approve(id, approverId)
    await broadcastApprovalEvent('request:approved', { requestId: id })
    return NextResponse.json(updated)
  }).catch(handleApiError)
}
