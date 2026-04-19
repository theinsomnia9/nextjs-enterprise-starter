import { NextResponse } from 'next/server'
import { withApi } from '@/lib/api/withApi'
import { broadcastApprovalEvent } from '@/lib/approvals/sseServer'
import { getActorId } from '@/lib/auth/actor'
import { approvalService } from '@/services/approvalService'

export const POST = withApi<{ id: string }>('approvals.release', async (_req, { params }) => {
  const { id } = await params
  const reviewerId = await getActorId()
  const updated = await approvalService.release(id, reviewerId)
  await broadcastApprovalEvent('request:unlocked', { requestId: id, reason: 'manual_release' })
  return NextResponse.json(updated)
})
