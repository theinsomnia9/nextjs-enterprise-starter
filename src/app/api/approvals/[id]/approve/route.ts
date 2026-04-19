import { NextResponse } from 'next/server'
import { withApi } from '@/lib/api/withApi'
import { broadcastApprovalEvent } from '@/lib/approvals/sseServer'
import { getActorId } from '@/lib/auth/actor'
import { requireAnyRole } from '@/lib/auth/requireRole'
import { Role } from '@/lib/auth/roles'
import { approvalService } from '@/services/approvalService'

const APPROVER_ROLES: readonly Role[] = [Role.Approver, Role.Admin]

export const POST = withApi<{ id: string }>('approvals.approve', async (_req, { params }) => {
  await requireAnyRole(APPROVER_ROLES)
  const { id } = await params
  const approverId = await getActorId()
  const updated = await approvalService.approve(id, approverId)
  await broadcastApprovalEvent('request:approved', { requestId: id })
  return NextResponse.json(updated)
})
