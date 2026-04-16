'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ApprovalFlowDiagram } from '@/components/approval/ApprovalFlowDiagram'
import type { QueueRequest } from '@/components/approval/QueueDashboard'

interface ApprovalDetailPageProps {
  params: { id: string }
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-[hsl(var(--status-pending))]/10 text-[hsl(var(--status-pending))] border border-[hsl(var(--status-pending))]/20',
  REVIEWING: 'bg-[hsl(var(--status-reviewing))]/10 text-[hsl(var(--status-reviewing))] border border-[hsl(var(--status-reviewing))]/20',
  APPROVED: 'bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))] border border-[hsl(var(--status-approved))]/20',
  REJECTED: 'bg-[hsl(var(--status-rejected))]/10 text-[hsl(var(--status-rejected))] border border-[hsl(var(--status-rejected))]/20',
}

export default function ApprovalDetailPage({ params }: ApprovalDetailPageProps) {
  const router = useRouter()
  const [request, setRequest] = useState<QueueRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    fetch(`/api/approvals/${params.id}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? 'Failed to load approval request')
        }
        return res.json() as Promise<QueueRequest>
      })
      .then((data) => {
        setRequest(data)
      })
      .catch((e: Error) => {
        if (e.name === 'AbortError') return
        setError(e.message)
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [params.id])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="text-muted-foreground">Loading…</span>
      </div>
    )
  }

  if (error || !request) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <span className="text-destructive">{error ?? 'Request not found'}</span>
        <button
          data-testid="back-to-queue"
          onClick={() => router.push('/approvals')}
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
        >
          ← Back to queue
        </button>
      </div>
    )
  }

  return (
    <main className="mx-auto flex h-[calc(100vh-4rem)] max-w-6xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <button
            data-testid="back-to-queue"
            onClick={() => router.push('/approvals')}
            className="flex w-fit items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            ← Back to queue
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded px-2 py-0.5 text-xs font-bold ${request.category === 'P1'
                  ? 'bg-[hsl(var(--priority-p1))]/10 text-[hsl(var(--priority-p1))]'
                  : request.category === 'P2'
                    ? 'bg-[hsl(var(--priority-p2))]/10 text-[hsl(var(--priority-p2))]'
                    : request.category === 'P3'
                      ? 'bg-[hsl(var(--priority-p3))]/10 text-[hsl(var(--priority-p3))]'
                      : 'bg-[hsl(var(--priority-p4))]/10 text-[hsl(var(--priority-p4))]'
                }`}
            >
              {request.category}
            </span>
            <h1 className="text-xl font-bold">{request.title}</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[request.status] ?? ''}`}
            >
              {request.status}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Submitted by {request.requester.name ?? request.requester.email}</span>
            <span>·</span>
            <span>Score: {Math.round(request.priorityScore)}</span>
            <span>·</span>
            <span>{new Date(request.submittedAt).toLocaleDateString()}</span>
            {request.assignee && (
              <>
                <span>·</span>
                <span>Reviewer: {request.assignee.name ?? request.assignee.email}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Click any node to see details. Node positions and state update in real time for all viewers.
      </p>

      <div className="min-h-0 flex-1">
        <ApprovalFlowDiagram request={request} roomId={`approval-${request.id}`} />
      </div>
    </main>
  )
}
