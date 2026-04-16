'use client'

import { useMemo } from 'react'
import { ApprovalPipeline, type StatusCounts } from './ApprovalPipeline'

export type QueueRequest = {
  id: string
  title: string
  category: string
  status: string
  priorityScore: number
  requester: { id: string; name: string | null; email: string | null }
  assignee: { id: string; name: string | null; email: string | null } | null
  lockedAt: string | null
  lockExpiresAt: string | null
  submittedAt: string
}

interface QueueDashboardProps {
  requests: QueueRequest[]
  counts?: StatusCounts
  currentUserId: string
  onRefresh?: () => void
  onLock?: (requestId: string) => void
  onRelease?: (requestId: string) => void
  onApprove?: (requestId: string) => void
  onReject?: (requestId: string) => void
}

const CATEGORY_COLORS: Record<string, string> = {
  P1: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  P2: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  P3: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  P4: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

function isLockActive(lockExpiresAt: string | null): boolean {
  if (!lockExpiresAt) return false
  return new Date(lockExpiresAt) > new Date()
}

export function QueueDashboard({
  requests,
  counts: countsProp,
  currentUserId,
  onRefresh,
  onLock,
  onRelease,
  onApprove,
  onReject,
}: QueueDashboardProps) {
  const derivedCounts = useMemo<StatusCounts>(() => {
    const c: StatusCounts = { PENDING: 0, REVIEWING: 0, APPROVED: 0, REJECTED: 0 }
    requests.forEach((r) => {
      if (r.status in c) c[r.status as keyof StatusCounts]++
    })
    return c
  }, [requests])

  const counts = countsProp ?? derivedCounts

  return (
    <div data-testid="queue-dashboard" className="flex flex-col gap-6 p-4">
      <ApprovalPipeline initialCounts={counts} onRefresh={onRefresh} />

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
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 shadow-sm"
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
                        className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"
                        title={`Locked by ${req.assignee?.name ?? 'reviewer'}`}
                      >
                        🔒
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
                      onClick={() => onLock?.(req.id)}
                      className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                      disabled={locked && !lockedByMe}
                    >
                      Lock
                    </button>
                  )}

                  {req.status === 'REVIEWING' && lockedByMe && (
                    <>
                      <button
                        onClick={() => onApprove?.(req.id)}
                        className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => onReject?.(req.id)}
                        className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => onRelease?.(req.id)}
                        className="rounded border border-border px-3 py-1 text-xs font-medium hover:bg-accent"
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
