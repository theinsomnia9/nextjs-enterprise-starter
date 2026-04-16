'use client'

import { useState, useEffect, useCallback } from 'react'
import { QueueDashboard, type QueueRequest } from '@/components/approval/QueueDashboard'

const CURRENT_USER_ID = 'system' // TODO: replace with session.user.id when auth is configured

export default function ApprovalsPage() {
  const [requests, setRequests] = useState<QueueRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/approvals/queue')
      if (!res.ok) throw new Error('Failed to load queue')
      const data = await res.json()
      setRequests(data.requests)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  const handleLock = useCallback(
    async (requestId: string) => {
      await fetch(`/api/approvals/${requestId}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewerId: CURRENT_USER_ID }),
      })
      await fetchQueue()
    },
    [fetchQueue]
  )

  const handleRelease = useCallback(
    async (requestId: string) => {
      await fetch(`/api/approvals/${requestId}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewerId: CURRENT_USER_ID }),
      })
      await fetchQueue()
    },
    [fetchQueue]
  )

  const handleApprove = useCallback(
    async (requestId: string) => {
      await fetch(`/api/approvals/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approverId: CURRENT_USER_ID }),
      })
      await fetchQueue()
    },
    [fetchQueue]
  )

  const handleReject = useCallback(
    async (requestId: string) => {
      const reason = window.prompt('Rejection reason:')
      if (!reason) return
      await fetch(`/api/approvals/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectorId: CURRENT_USER_ID, reason }),
      })
      await fetchQueue()
    },
    [fetchQueue]
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
        currentUserId={CURRENT_USER_ID}
        onLock={handleLock}
        onRelease={handleRelease}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </main>
  )
}
