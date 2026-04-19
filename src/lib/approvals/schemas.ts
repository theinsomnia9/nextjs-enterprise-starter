import { z } from 'zod'

export const createApprovalSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(5000).optional(),
  category: z.enum(['P1', 'P2', 'P3', 'P4']),
  requesterId: z.string().min(1, 'Requester ID is required'),
})

export const rejectApprovalSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required').max(1000),
})

export type CreateApprovalInput = z.infer<typeof createApprovalSchema>
export type RejectApprovalInput = z.infer<typeof rejectApprovalSchema>

export const lockSchema = z.object({
  requestId: z.string().min(1, 'Request ID is required'),
})

export const releaseSchema = z.object({
  requestId: z.string().min(1, 'Request ID is required'),
})

export const approveSchema = z.object({
  requestId: z.string().min(1, 'Request ID is required'),
})

export const rejectSchema = z.object({
  requestId: z.string().min(1, 'Request ID is required'),
  reason: z.string().min(1, 'Rejection reason is required').max(1000),
})

export type LockInput = z.infer<typeof lockSchema>
export type ReleaseInput = z.infer<typeof releaseSchema>
export type ApproveInput = z.infer<typeof approveSchema>
export type RejectInput = z.infer<typeof rejectSchema>
