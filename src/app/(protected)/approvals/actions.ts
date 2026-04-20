'use server'

import { wrapAction } from '@/lib/actions/result'
import { approvalService } from '@/services/approvalService'
import { broadcastApprovalEvent } from '@/lib/approvals/sseServer'
import {
  lockSchema,
  releaseSchema,
  approveSchema,
  rejectSchema,
} from '@/lib/approvals/schemas'
import { requireAnyRole } from '@/lib/auth/requireRole'
import { APPROVER_ROLES } from '@/lib/auth/roles'

async function safeBroadcast(event: Parameters<typeof broadcastApprovalEvent>[0], data: Record<string, unknown>) {
  try {
    await broadcastApprovalEvent(event, data)
  } catch (err) {
    console.error(`[action] broadcast ${event} failed`, err)
  }
}

export async function lockAction(requestId: string, _formData?: FormData) {
  return wrapAction('approvals.lock', async (actor) => {
    await requireAnyRole(APPROVER_ROLES)
    const parsed = lockSchema.parse({ requestId })
    const updated = await approvalService.lock(parsed.requestId, actor.id)
    await safeBroadcast('request:locked', {
      requestId: parsed.requestId,
      reviewerId: actor.id,
      expiresAt: updated.lockExpiresAt?.toISOString(),
    })
    return updated
  })
}

export async function releaseAction(requestId: string, _formData?: FormData) {
  return wrapAction('approvals.release', async (actor) => {
    await requireAnyRole(APPROVER_ROLES)
    const parsed = releaseSchema.parse({ requestId })
    const updated = await approvalService.release(parsed.requestId, actor.id)
    await safeBroadcast('request:unlocked', {
      requestId: parsed.requestId,
      reason: 'manual_release',
    })
    return updated
  })
}

export async function approveAction(requestId: string, _formData?: FormData) {
  return wrapAction('approvals.approve', async (actor) => {
    await requireAnyRole(APPROVER_ROLES)
    const parsed = approveSchema.parse({ requestId })
    const updated = await approvalService.approve(parsed.requestId, actor.id)
    await safeBroadcast('request:approved', { requestId: parsed.requestId })
    return updated
  })
}

export async function rejectAction(requestId: string, formData: FormData) {
  return wrapAction('approvals.reject', async (actor) => {
    await requireAnyRole(APPROVER_ROLES)
    const reason = (formData.get('reason') ?? '') as string
    const parsed = rejectSchema.parse({ requestId, reason })
    const updated = await approvalService.reject(parsed.requestId, actor.id, parsed.reason)
    await safeBroadcast('request:rejected', {
      requestId: parsed.requestId,
      reason: parsed.reason,
    })
    return updated
  })
}
