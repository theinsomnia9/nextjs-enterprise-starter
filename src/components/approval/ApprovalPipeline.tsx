'use client'

import { useEffect, useState } from 'react'
import PusherJS from 'pusher-js'
import { APPROVAL_CHANNEL } from '@/lib/approvals/constants'

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
  PENDING: '#6366f1',
  REVIEWING: '#f59e0b',
  APPROVED: '#22c55e',
  REJECTED: '#ef4444',
}

export function ApprovalPipeline({ initialCounts, onRefresh }: ApprovalPipelineProps) {
  const [counts, setCounts] = useState<StatusCounts>(initialCounts)

  useEffect(() => {
    setCounts(initialCounts)
  }, [initialCounts])

  useEffect(() => {
    const appKey = process.env.NEXT_PUBLIC_PUSHER_APP_KEY
    if (!appKey) {
      console.warn(
        '[ApprovalPipeline] NEXT_PUBLIC_PUSHER_APP_KEY not set — real-time updates disabled'
      )
      return
    }

    const pusher = new PusherJS(appKey, {
      wsHost: process.env.NEXT_PUBLIC_PUSHER_HOST ?? 'localhost',
      wsPort: Number(process.env.NEXT_PUBLIC_PUSHER_PORT ?? '6001'),
      forceTLS: false,
      enabledTransports: ['ws'],
      authEndpoint: '/api/pusher/auth',
      cluster: 'self-hosted',
      disableStats: true,
    })

    const channel = pusher.subscribe(APPROVAL_CHANNEL)

    const refresh = () => {
      onRefresh?.()
    }

    channel.bind('request:submitted', refresh)
    channel.bind('request:locked', refresh)
    channel.bind('request:unlocked', refresh)
    channel.bind('request:approved', refresh)
    channel.bind('request:rejected', refresh)
    channel.bind('queue:counts', refresh)

    return () => {
      channel.unbind_all()
      pusher.unsubscribe(APPROVAL_CHANNEL)
      pusher.disconnect()
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
