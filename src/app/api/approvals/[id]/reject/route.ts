import { NextResponse } from 'next/server'
import { withApi } from '@/lib/api/withApi'
import { broadcastApprovalEvent } from '@/lib/approvals/sseServer'
import { getActorId } from '@/lib/auth/actor'
import { requireAnyRole } from '@/lib/auth/requireRole'
import { Role } from '@/lib/auth/roles'
import { approvalService } from '@/services/approvalService'
import { validationError } from '@/lib/errors/AppError'
import { z } from 'zod'

const rejectBodySchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
})

const APPROVER_ROLES: readonly Role[] = [Role.Approver, Role.Admin]

export const POST = withApi<{ id: string }>('approvals.reject', async (req, { params }) => {
  await requireAnyRole(APPROVER_ROLES)
  const body = await req.json()
  const parsed = rejectBodySchema.safeParse(body)
  if (!parsed.success) throw validationError(parsed.error.errors[0].message)

  const { id } = await params
  const rejectorId = await getActorId()
  const updated = await approvalService.reject(id, rejectorId, parsed.data.reason)
  await broadcastApprovalEvent('request:rejected', { requestId: id, reason: parsed.data.reason })
  return NextResponse.json(updated)
})
