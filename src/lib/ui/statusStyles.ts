import type { ApprovalStatus } from '@/generated/prisma/client'
import type { PriorityCategory } from '@/lib/approvals/types'

export const STATUS_COLORS: Record<ApprovalStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  REVIEWING: 'bg-blue-100 text-blue-800 border-blue-200',
  APPROVED: 'bg-green-100 text-green-800 border-green-200',
  REJECTED: 'bg-red-100 text-red-800 border-red-200',
  CANCELLED: 'bg-gray-100 text-gray-800 border-gray-200',
}

export const STATUS_LABELS: Record<ApprovalStatus, string> = {
  PENDING: 'Pending',
  REVIEWING: 'Reviewing',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
}

export const CATEGORY_COLORS: Record<PriorityCategory, string> = {
  P1: 'bg-red-600 text-white',
  P2: 'bg-orange-500 text-white',
  P3: 'bg-yellow-500 text-white',
  P4: 'bg-green-500 text-white',
}

export const CATEGORY_LABELS: Record<PriorityCategory, string> = {
  P1: 'P1 - Critical',
  P2: 'P2 - High',
  P3: 'P3 - Medium',
  P4: 'P4 - Low',
}

export function getStatusBadgeClass(status: ApprovalStatus): string {
  return STATUS_COLORS[status] ?? STATUS_COLORS.PENDING
}

export function getStatusLabel(status: ApprovalStatus): string {
  return STATUS_LABELS[status] ?? status
}

export function getCategoryBadgeClass(category: PriorityCategory): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.P4
}

export function getCategoryLabel(category: PriorityCategory): string {
  return CATEGORY_LABELS[category] ?? category
}
