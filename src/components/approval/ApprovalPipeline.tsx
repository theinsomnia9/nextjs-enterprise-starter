'use client'

import { useEffect, useState } from 'react'
import { useApprovalEvents } from '@/lib/sse/useApprovalEvents'

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

export function ApprovalPipeline({ initialCounts, onRefresh }: ApprovalPipelineProps) {
  const [counts, setCounts] = useState<StatusCounts>(initialCounts)

  useEffect(() => {
    setCounts(initialCounts)
  }, [initialCounts])

  useApprovalEvents({ onRefresh })

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
