import { z } from 'zod'

const requestIdField = z.string().min(1, 'Request ID is required')
const rejectionReasonField = z.string().min(1, 'Rejection reason is required').max(1000)

export const createApprovalSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(5000).optional(),
  category: z.enum(['P1', 'P2', 'P3', 'P4']),
  requesterId: z.string().min(1, 'Requester ID is required'),
})

export const rejectApprovalSchema = z.object({
  reason: rejectionReasonField,
})

export type CreateApprovalInput = z.infer<typeof createApprovalSchema>
export type RejectApprovalInput = z.infer<typeof rejectApprovalSchema>

export const requestIdSchema = z.object({ requestId: requestIdField })
export const lockSchema = requestIdSchema
export const releaseSchema = requestIdSchema
export const approveSchema = requestIdSchema

export const rejectSchema = z.object({
  requestId: requestIdField,
  reason: rejectionReasonField,
})

export type LockInput = z.infer<typeof lockSchema>
export type ReleaseInput = z.infer<typeof releaseSchema>
export type ApproveInput = z.infer<typeof approveSchema>
export type RejectInput = z.infer<typeof rejectSchema>
