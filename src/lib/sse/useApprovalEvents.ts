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
  const handlersRef = useRef<Map<string, (e: MessageEvent) => void>>(new Map())

  // Stable refs so connect/disconnect have no callback deps and never change identity
  const onEventRef = useRef(onEvent)
  const onRefreshRef = useRef(onRefresh)
  const onErrorRef = useRef(onError)
  const eventsRef = useRef(events)

  useEffect(() => { onEventRef.current = onEvent }, [onEvent])
  useEffect(() => { onRefreshRef.current = onRefresh }, [onRefresh])
  useEffect(() => { onErrorRef.current = onError }, [onError])
  useEffect(() => { eventsRef.current = events }, [events])

  const connect = useCallback(() => {
    if (eventSourceRef.current) return

    const eventSource = new EventSource('/api/sse/approvals')
    eventSourceRef.current = eventSource

    eventsRef.current.forEach((eventType) => {
      const handler = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data as string)
          onEventRef.current?.(eventType, data)
          if (REFRESH_EVENTS.includes(eventType)) onRefreshRef.current?.()
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
        if (parsed.event && REFRESH_EVENTS.includes(parsed.event)) onRefreshRef.current?.()
      } catch {
        // ignore malformed messages
      }
    }
    handlersRef.current.set('message', messageHandler)
    eventSource.addEventListener('message', messageHandler)

    eventSource.addEventListener('error', () => onErrorRef.current?.())
  }, [])

  const disconnect = useCallback(() => {
    const es = eventSourceRef.current
    if (!es) return

    handlersRef.current.forEach((handler, eventType) => {
      es.removeEventListener(eventType, handler)
    })
    handlersRef.current.clear()
    es.close()
    eventSourceRef.current = null
  }, [])

  useEffect(() => {
    connect()
    return disconnect
  }, [connect, disconnect])

  return { connect, disconnect }
}

export { SSE_EVENTS, REFRESH_EVENTS }
export type { SSEEventType }
