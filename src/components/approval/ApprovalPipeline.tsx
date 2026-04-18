'use client'

import { useEffect, useState } from 'react'

export type StatusCounts = {
  PENDING: number
  REVIEWING: number
  APPROVED: number
  REJECTED: number
}

interface ApprovalPipelineProps {
  initialCounts: StatusCounts
  onRefresh?: () => void
}

const STAGE_LABELS: (keyof StatusCounts)[] = ['PENDING', 'REVIEWING', 'APPROVED', 'REJECTED']

const STAGE_COLORS: Record<keyof StatusCounts, string> = {
  PENDING: 'hsl(var(--status-pending))',
  REVIEWING: 'hsl(var(--status-reviewing))',
  APPROVED: 'hsl(var(--status-approved))',
  REJECTED: 'hsl(var(--status-rejected))',
}

// List of events that trigger a refresh
const REFRESH_EVENTS = [
  'request:submitted',
  'request:locked',
  'request:unlocked',
  'request:approved',
  'request:rejected',
  'queue:counts',
]

export function ApprovalPipeline({ initialCounts, onRefresh }: ApprovalPipelineProps) {
  const [counts, setCounts] = useState<StatusCounts>(initialCounts)

  useEffect(() => {
    setCounts(initialCounts)
  }, [initialCounts])

  useEffect(() => {
    // Use Server-Sent Events (SSE) instead of WebSockets
    const eventSource = new EventSource('/api/sse/approvals')

    // Handle specific event types from server
    const handleApprovalEvent = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        const eventType = event.type as (typeof REFRESH_EVENTS)[number]
        console.log('[ApprovalPipeline] SSE event received:', eventType, data)
        if (REFRESH_EVENTS.includes(eventType)) {
          console.log('[ApprovalPipeline] Triggering refresh for event:', eventType)
          onRefresh?.()
        }
      } catch (err) {
        console.error('[ApprovalPipeline] Failed to parse SSE data:', err)
      }
    }

    // Handle generic message events (fallback)
    const handleMessage = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data)
        console.log('[ApprovalPipeline] Generic SSE message:', parsed)
        if (parsed.event && REFRESH_EVENTS.includes(parsed.event)) {
          console.log('[ApprovalPipeline] Triggering refresh from message:', parsed.event)
          onRefresh?.()
        }
      } catch {
        // Ignore malformed messages or ping events
      }
    }

    const handleError = () => {
      // Auto-reconnect is built into EventSource
      console.warn('[ApprovalPipeline] SSE connection error - will retry automatically')
    }

    // Listen for specific approval events
    REFRESH_EVENTS.forEach((eventName) => {
      eventSource.addEventListener(eventName, handleApprovalEvent)
    })
    // Also listen for generic messages as fallback
    eventSource.addEventListener('message', handleMessage)
    eventSource.addEventListener('error', handleError)

    return () => {
      REFRESH_EVENTS.forEach((eventName) => {
        eventSource.removeEventListener(eventName, handleApprovalEvent)
      })
      eventSource.removeEventListener('message', handleMessage)
      eventSource.removeEventListener('error', handleError)
      eventSource.close()
    }
  }, [onRefresh])

  return (
    <div data-testid="approval-pipeline" className="flex w-full gap-3">
      {STAGE_LABELS.map((label) => (
        <div
          key={label}
          className="flex flex-1 flex-col items-center rounded-lg px-3 py-4 shadow-sm"
          style={{ background: STAGE_COLORS[label] }}
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
            {label}
          </span>
          <span className="mt-1 text-2xl font-bold text-white">{counts[label]}</span>
        </div>
      ))}
    </div>
  )
}
