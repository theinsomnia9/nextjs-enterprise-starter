'use client'

import { useRouter } from 'next/navigation'
import { ApprovalPipeline, type StatusCounts } from './ApprovalPipeline'
import { CATEGORY_COLORS } from '@/lib/approvals/constants'
import type { ApprovalStatusType, PriorityCategory } from '@/lib/approvals/types'

export type QueueRequest = {
  id: string
  title: string
  category: PriorityCategory
  status: ApprovalStatusType
  priorityScore: number
  requester: { id: string; name: string | null; email: string | null }
  assignee: { id: string; name: string | null; email: string | null } | null
  lockedAt: string | null
  lockExpiresAt: string | null
  submittedAt: string
}

interface QueueDashboardProps {
  requests: QueueRequest[]
  counts: StatusCounts
  currentUserId: string
  onRefresh?: () => void
  onLock?: (requestId: string) => void
  onRelease?: (requestId: string) => void
  onApprove?: (requestId: string) => void
  onReject?: (requestId: string) => void
}


function isLockActive(lockExpiresAt: string | null): boolean {
  if (!lockExpiresAt) return false
  return new Date(lockExpiresAt) > new Date()
}

export function QueueDashboard({
  requests,
  counts,
  currentUserId,
  onRefresh,
  onLock,
  onRelease,
  onApprove,
  onReject,
}: QueueDashboardProps) {
  const router = useRouter()

  return (
    <div data-testid="queue-dashboard" className="flex flex-col gap-6 p-4">
      <ApprovalPipeline counts={counts} onRefresh={onRefresh} />

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Approval Queue ({requests.length})
        </h2>

        <div className="flex flex-col gap-2">
          {requests.map((req) => {
            const locked = isLockActive(req.lockExpiresAt)
            const lockedByMe = locked && req.assignee?.id === currentUserId

            return (
              <div
                key={req.id}
                data-testid={`queue-item-${req.id}`}
                tabIndex={0}
                onClick={() => router.push(`/approvals/${req.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') router.push(`/approvals/${req.id}`)
                }}
                className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-card px-4 py-3 shadow-sm transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-bold ${CATEGORY_COLORS[req.category] ?? ''}`}
                    >
                      {req.category}
                    </span>
                    <span className="truncate font-medium">{req.title}</span>
                    {locked && (
                      <span
                        data-testid={`lock-indicator-${req.id}`}
                        className="flex items-center gap-1 text-xs text-[hsl(var(--status-reviewing))]"
                        title={`Locked by ${req.assignee?.name ?? 'reviewer'}`}
                      >
                        <span>🔒</span>
                        {req.assignee?.name && (
                          <span className="hidden sm:inline">{req.assignee.name}</span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{req.requester.name ?? req.requester.email}</span>
                    <span>Score: {Math.round(req.priorityScore)}</span>
                    <span>{new Date(req.submittedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {req.status === 'PENDING' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onLock?.(req.id)
                      }}
                      className="interactive rounded bg-[hsl(var(--status-pending))] px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                      disabled={locked && !lockedByMe}
                    >
                      Lock
                    </button>
                  )}

                  {req.status === 'REVIEWING' && lockedByMe && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onApprove?.(req.id)
                        }}
                        className="interactive rounded bg-[hsl(var(--status-approved))] px-3 py-1 text-xs font-medium text-white hover:opacity-90"
                      >
                        Approve
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onReject?.(req.id)
                        }}
                        className="interactive rounded bg-[hsl(var(--status-rejected))] px-3 py-1 text-xs font-medium text-white hover:opacity-90"
                      >
                        Reject
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onRelease?.(req.id)
                        }}
                        className="interactive rounded border border-border px-3 py-1 text-xs font-medium hover:bg-accent"
                      >
                        Release
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
