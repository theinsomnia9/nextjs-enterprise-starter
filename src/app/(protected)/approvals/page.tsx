'use client'

import { useState, useEffect, useCallback } from 'react'
import { QueueDashboard, type QueueRequest } from '@/components/approval/QueueDashboard'
import { RejectModal } from '@/components/approval/RejectModal'
import type { StatusCounts } from '@/components/approval/ApprovalPipeline'
import { useRequiredSession } from '@/components/auth/use-session'

export default function ApprovalsPage() {
  const { userId: CURRENT_USER_ID } = useRequiredSession()
  const [requests, setRequests] = useState<QueueRequest[]>([])
  const [counts, setCounts] = useState<StatusCounts>({
    PENDING: 0,
    REVIEWING: 0,
    APPROVED: 0,
    REJECTED: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)

  const fetchQueue = useCallback(async (isInitialLoad = false) => {
    try {
      const res = await fetch('/api/approvals/queue')
      if (!res.ok) throw new Error('Failed to load queue')
      const data = await res.json()
      setRequests(data.requests)
      if (data.counts) setCounts(data.counts as StatusCounts)
      if (isInitialLoad) setError(null)
    } catch (e) {
      if (isInitialLoad) setError(e instanceof Error ? e.message : 'Unknown error')
      else console.error('[fetchQueue] refresh failed:', e)
    } finally {
      if (isInitialLoad) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQueue(true)
  }, [fetchQueue])

  const post = useCallback(
    async (path: string, body: Record<string, string>) => {
      await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      await fetchQueue()
    },
    [fetchQueue]
  )

  const handleLock = useCallback(
    (requestId: string) => post(`/api/approvals/${requestId}/lock`, { reviewerId: CURRENT_USER_ID }),
    [post]
  )

  const handleRelease = useCallback(
    (requestId: string) =>
      post(`/api/approvals/${requestId}/release`, { reviewerId: CURRENT_USER_ID }),
    [post]
  )

  const handleApprove = useCallback(
    (requestId: string) =>
      post(`/api/approvals/${requestId}/approve`, { approverId: CURRENT_USER_ID }),
    [post]
  )

  const handleReject = useCallback((requestId: string) => setRejectTarget(requestId), [])

  const confirmReject = useCallback(
    async (reason: string) => {
      if (!rejectTarget || !reason.trim()) return
      await post(`/api/approvals/${rejectTarget}/reject`, {
        rejectorId: CURRENT_USER_ID,
        reason: reason.trim(),
      })
      setRejectTarget(null)
    },
    [rejectTarget, post]
  )

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="text-muted-foreground">Loading queue…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="text-destructive">{error}</span>
      </div>
    )
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Approval Queue</h1>
      <QueueDashboard
        requests={requests}
        counts={counts}
        currentUserId={CURRENT_USER_ID}
        onRefresh={fetchQueue}
        onLock={handleLock}
        onRelease={handleRelease}
        onApprove={handleApprove}
        onReject={handleReject}
      />

      {rejectTarget && (
        <RejectModal onConfirm={confirmReject} onCancel={() => setRejectTarget(null)} />
      )}
    </main>
  )
}
