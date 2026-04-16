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
