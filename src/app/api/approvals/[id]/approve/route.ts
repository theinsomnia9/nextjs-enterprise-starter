import { NextResponse } from 'next/server'
import { withApi } from '@/lib/api/withApi'
import { broadcastApprovalEvent } from '@/lib/approvals/sseServer'
import { getActorId } from '@/lib/auth/actor'
import { approvalService } from '@/services/approvalService'

export const POST = withApi<{ id: string }>('approvals.approve', async (_req, { params }) => {
  const { id } = await params
  const approverId = await getActorId()
  const updated = await approvalService.approve(id, approverId)
  await broadcastApprovalEvent('request:approved', { requestId: id })
  return NextResponse.json(updated)
})
