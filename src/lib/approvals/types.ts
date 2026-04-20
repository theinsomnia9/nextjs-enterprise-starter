export const PriorityCategory = {
  P1: 'P1',
  P2: 'P2',
  P3: 'P3',
  P4: 'P4',
} as const

export type PriorityCategory = (typeof PriorityCategory)[keyof typeof PriorityCategory]

export const ApprovalStatus = {
  Pending: 'PENDING',
  Reviewing: 'REVIEWING',
  Approved: 'APPROVED',
  Rejected: 'REJECTED',
  Cancelled: 'CANCELLED',
} as const

export type ApprovalStatusType = (typeof ApprovalStatus)[keyof typeof ApprovalStatus]

export interface PriorityConfigValues {
  baseWeight: number
  agingFactor: number
  slaHours: number
  lockTimeoutMinutes: number
}

export interface DefaultPriorityConfig extends PriorityConfigValues {
  category: PriorityCategory
}
