import type { QueueRequest } from '@/components/approval/QueueDashboard'

type SerializableRequest = {
  id: string
  title: string
  category: QueueRequest['category']
  status: QueueRequest['status']
  priorityScore: number
  requester: QueueRequest['requester']
  assignee: QueueRequest['assignee']
  lockedAt: Date | null
  lockExpiresAt: Date | null
  submittedAt: Date
}

export function toQueueRequest(row: SerializableRequest): QueueRequest {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    status: row.status,
    priorityScore: row.priorityScore,
    requester: row.requester,
    assignee: row.assignee,
    lockedAt: row.lockedAt?.toISOString() ?? null,
    lockExpiresAt: row.lockExpiresAt?.toISOString() ?? null,
    submittedAt: row.submittedAt.toISOString(),
  }
}
