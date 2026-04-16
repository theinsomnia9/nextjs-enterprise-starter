export type PriorityCategory = 'P1' | 'P2' | 'P3' | 'P4'

export type ApprovalStatusType = 'PENDING' | 'REVIEWING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export interface PriorityConfigValues {
  baseWeight: number
  agingFactor: number
  slaHours: number
  lockTimeoutMinutes: number
}

export interface DefaultPriorityConfig extends PriorityConfigValues {
  category: PriorityCategory
}
