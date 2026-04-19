import { NextResponse } from 'next/server'
import { withApi } from '@/lib/api/withApi'
import { broadcastApprovalEvent } from '@/lib/approvals/sseServer'
import { getActorId } from '@/lib/auth/actor'
import { requireAnyRole } from '@/lib/auth/requireRole'
import { Role } from '@/lib/auth/roles'
import { approvalService } from '@/services/approvalService'

const APPROVER_ROLES: readonly Role[] = [Role.Approver, Role.Admin]

export const POST = withApi<{ id: string }>('approvals.lock', async (_req, { params }) => {
  await requireAnyRole(APPROVER_ROLES)
  const { id } = await params
  const reviewerId = await getActorId()
  const updated = await approvalService.lock(id, reviewerId)
  await broadcastApprovalEvent('request:locked', {
    requestId: id,
    reviewerId,
    expiresAt: updated.lockExpiresAt?.toISOString(),
  })
  return NextResponse.json(updated)
})
