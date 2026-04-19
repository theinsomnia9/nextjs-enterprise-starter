'use client'

import { useOptimistic, useTransition } from 'react'
import { QueueDashboard, type QueueRequest } from '@/components/approval/QueueDashboard'
import { RejectModal } from '@/components/approval/RejectModal'
import type { StatusCounts } from '@/components/approval/ApprovalPipeline'
import { lockAction, releaseAction, approveAction, rejectAction } from '@/app/(protected)/approvals/actions'
import type { ActionResult } from '@/lib/actions/result'
import { useState } from 'react'

type OptimisticPatch =
  | { type: 'lock'; id: string; reviewerId: string }
  | { type: 'release'; id: string }
  | { type: 'approve'; id: string }
  | { type: 'reject'; id: string }

interface QueueClientProps {
  initialRequests: QueueRequest[]
  initialCounts: StatusCounts
  currentUserId: string
}

function applyPatch(requests: QueueRequest[], patch: OptimisticPatch): QueueRequest[] {
  return requests.map((r) => {
    if (r.id !== patch.id) return r
    switch (patch.type) {
      case 'lock':
        return {
          ...r,
          status: 'REVIEWING',
          assignee: { id: patch.reviewerId, name: null, email: null },
          lockExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        }
      case 'release':
        return { ...r, status: 'PENDING', assignee: null, lockExpiresAt: null }
      case 'approve':
      case 'reject':
        return r // removed from active queue on server refresh via SSE
    }
  })
}

function toastError(message: string) {
  // Minimal inline feedback — replace with toast lib if available.
  console.error('[QueueClient]', message)
  if (typeof window !== 'undefined') window.alert(message)
}

export function QueueClient({ initialRequests, initialCounts, currentUserId }: QueueClientProps) {
  const [requests, setRequests] = useState(initialRequests)
  const [counts] = useState(initialCounts)
  const [optimisticRequests, applyOptimistic] = useOptimistic(requests, applyPatch)
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const handleLock = (id: string) => {
    startTransition(async () => {
      applyOptimistic({ type: 'lock', id, reviewerId: currentUserId })
      const result: ActionResult<unknown> = await lockAction(id)
      if (!result.ok) toastError(result.error.message)
    })
  }

  const handleRelease = (id: string) => {
    startTransition(async () => {
      applyOptimistic({ type: 'release', id })
      const result = await releaseAction(id)
      if (!result.ok) toastError(result.error.message)
    })
  }

  const handleApprove = (id: string) => {
    startTransition(async () => {
      applyOptimistic({ type: 'approve', id })
      const result = await approveAction(id)
      if (!result.ok) toastError(result.error.message)
      else setRequests((prev) => prev.filter((r) => r.id !== id))
    })
  }

  const handleReject = (id: string) => setRejectTarget(id)

  const confirmReject = async (reason: string) => {
    const id = rejectTarget
    if (!id) return
    const fd = new FormData()
    fd.set('reason', reason)
    startTransition(async () => {
      applyOptimistic({ type: 'reject', id })
      const result = await rejectAction(id, fd)
      if (!result.ok) toastError(result.error.message)
      else setRequests((prev) => prev.filter((r) => r.id !== id))
    })
    setRejectTarget(null)
  }

  const handleRefresh = () => {
    // SSE-driven refresh handled by QueueDashboard/ApprovalPipeline subscription.
    // Explicit refresh: re-fetch via a Server Action in a later iteration.
  }

  return (
    <>
      <QueueDashboard
        requests={optimisticRequests}
        counts={counts}
        currentUserId={currentUserId}
        onRefresh={handleRefresh}
        onLock={handleLock}
        onRelease={handleRelease}
        onApprove={handleApprove}
        onReject={handleReject}
      />
      {rejectTarget && (
        <RejectModal onConfirm={confirmReject} onCancel={() => setRejectTarget(null)} />
      )}
    </>
  )
}
