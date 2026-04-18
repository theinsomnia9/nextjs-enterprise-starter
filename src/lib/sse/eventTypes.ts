export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
} as const

export const SSE_EVENTS = {
  REQUEST_SUBMITTED: 'request:submitted',
  REQUEST_LOCKED: 'request:locked',
  REQUEST_UNLOCKED: 'request:unlocked',
  REQUEST_APPROVED: 'request:approved',
  REQUEST_REJECTED: 'request:rejected',
  QUEUE_COUNTS: 'queue:counts',
} as const

export type SSEEventType = (typeof SSE_EVENTS)[keyof typeof SSE_EVENTS]

export const REFRESH_EVENTS: SSEEventType[] = [
  SSE_EVENTS.REQUEST_SUBMITTED,
  SSE_EVENTS.REQUEST_LOCKED,
  SSE_EVENTS.REQUEST_UNLOCKED,
  SSE_EVENTS.REQUEST_APPROVED,
  SSE_EVENTS.REQUEST_REJECTED,
  SSE_EVENTS.QUEUE_COUNTS,
]

export interface BaseSSEPayload {
  requestId?: string
  timestamp?: string
}

export interface RequestSubmittedPayload extends BaseSSEPayload {
  title: string
  category: string
}

export interface RequestLockedPayload extends BaseSSEPayload {
  reviewerId: string
  expiresAt?: string
}

export interface RequestUnlockedPayload extends BaseSSEPayload {
  reason: 'manual_release' | 'expired' | 'auto_release'
}

export interface RequestRejectedPayload extends BaseSSEPayload {
  reason: string
}

export interface QueueCountsPayload {
  expiredCount?: number
}
