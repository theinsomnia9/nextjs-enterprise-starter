'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { QueueDashboard, type QueueRequest } from '@/components/approval/QueueDashboard'

const CURRENT_USER_ID = 'dev-user-alice' // TODO: replace with session.user.id when auth is configured

export default function ApprovalsPage() {
  const [requests, setRequests] = useState<QueueRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const rejectInputRef = useRef<HTMLTextAreaElement>(null)

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

  useEffect(() => {
    if (rejectTarget) rejectInputRef.current?.focus()
  }, [rejectTarget])

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

  const handleReject = useCallback((requestId: string) => {
    setRejectReason('')
    setRejectTarget(requestId)
  }, [])

  const confirmReject = useCallback(async () => {
    if (!rejectTarget || !rejectReason.trim()) return
    await fetch(`/api/approvals/${rejectTarget}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectorId: CURRENT_USER_ID, reason: rejectReason.trim() }),
    })
    setRejectTarget(null)
    setRejectReason('')
    await fetchQueue()
  }, [rejectTarget, rejectReason, fetchQueue])

  const cancelReject = useCallback(() => {
    setRejectTarget(null)
    setRejectReason('')
  }, [])

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

      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-xl">
            <h2 className="mb-3 text-lg font-semibold">Rejection reason</h2>
            <textarea
              ref={rejectInputRef}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) confirmReject()
                if (e.key === 'Escape') cancelReject()
              }}
              placeholder="Describe why this request is being rejected…"
              rows={4}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={cancelReject}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                disabled={!rejectReason.trim()}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-40"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
