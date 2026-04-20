'use client'

import { useEffect, useMemo, useOptimistic, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { QueueDashboard, type QueueRequest } from '@/components/approval/QueueDashboard'
import { RejectModal } from '@/components/approval/RejectModal'
import type { StatusCounts } from '@/components/approval/ApprovalPipeline'
import { lockAction, releaseAction, approveAction, rejectAction } from '@/app/(protected)/approvals/actions'

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
  const router = useRouter()
  const [requests, setRequests] = useState(initialRequests)
  const [optimisticRequests, applyOptimistic] = useOptimistic(requests, applyPatch)
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // Sync with server data after router.refresh() (e.g. triggered by SSE events
  // from other users). useState(initialRequests) only reads the initial value
  // on mount, so prop updates are otherwise lost.
  useEffect(() => {
    setRequests(initialRequests)
  }, [initialRequests])

  const displayCounts = useMemo(
    () => ({
      PENDING: optimisticRequests.filter((r) => r.status === 'PENDING').length,
      REVIEWING: optimisticRequests.filter((r) => r.status === 'REVIEWING').length,
      APPROVED: initialCounts.APPROVED,
      REJECTED: initialCounts.REJECTED,
    }),
    [optimisticRequests, initialCounts]
  )

  const handleLock = (id: string) => {
    startTransition(async () => {
      const patch: OptimisticPatch = { type: 'lock', id, reviewerId: currentUserId }
      applyOptimistic(patch)
      const result = await lockAction(id)
      if (!result.ok) {
        toastError(result.error.message)
        return
      }
      setRequests((prev) => applyPatch(prev, patch))
    })
  }

  const handleRelease = (id: string) => {
    startTransition(async () => {
      const patch: OptimisticPatch = { type: 'release', id }
      applyOptimistic(patch)
      const result = await releaseAction(id)
      if (!result.ok) {
        toastError(result.error.message)
        return
      }
      setRequests((prev) => applyPatch(prev, patch))
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

  const handleRefresh = () => router.refresh()

  return (
    <>
      <QueueDashboard
        requests={optimisticRequests}
        counts={displayCounts}
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
