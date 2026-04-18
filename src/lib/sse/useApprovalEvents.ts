'use client'

import { useEffect, useCallback, useRef } from 'react'
import { REFRESH_EVENTS, SSE_EVENTS, type SSEEventType } from './eventTypes'

interface UseApprovalEventsOptions {
  onEvent?: (eventType: SSEEventType, data: unknown) => void
  onRefresh?: () => void
  onError?: () => void
  events?: SSEEventType[]
}

export function useApprovalEvents(options: UseApprovalEventsOptions) {
  const { onEvent, onRefresh, onError, events = REFRESH_EVENTS } = options
  const eventSourceRef = useRef<EventSource | null>(null)
  // Stable refs to avoid stale closures in cleanup
  const handlersRef = useRef<Map<SSEEventType, (e: MessageEvent) => void>>(new Map())

  const connect = useCallback(() => {
    if (eventSourceRef.current?.readyState === EventSource.OPEN) return

    const eventSource = new EventSource('/api/sse/approvals')
    eventSourceRef.current = eventSource

    events.forEach((eventType) => {
      const handler = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data as string)
          onEvent?.(eventType, data)
          if (REFRESH_EVENTS.includes(eventType)) onRefresh?.()
        } catch {
          // ignore malformed events
        }
      }
      handlersRef.current.set(eventType, handler)
      eventSource.addEventListener(eventType, handler)
    })

    const messageHandler = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data as string)
        if (parsed.event && REFRESH_EVENTS.includes(parsed.event)) onRefresh?.()
      } catch {
        // ignore malformed messages
      }
    }
    handlersRef.current.set('message' as SSEEventType, messageHandler)
    eventSource.addEventListener('message', messageHandler)

    if (onError) eventSource.addEventListener('error', onError)
  }, [events, onEvent, onRefresh, onError])

  const disconnect = useCallback(() => {
    const es = eventSourceRef.current
    if (!es) return

    handlersRef.current.forEach((handler, eventType) => {
      es.removeEventListener(eventType, handler)
    })
    handlersRef.current.clear()

    if (onError) es.removeEventListener('error', onError)
    es.close()
    eventSourceRef.current = null
  }, [onError])

  useEffect(() => {
    connect()
    return disconnect
  }, [connect, disconnect])

  return { connect, disconnect }
}

export { SSE_EVENTS, REFRESH_EVENTS }
export type { SSEEventType }
