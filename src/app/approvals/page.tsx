import { approvalService } from '@/services/approvalService'
import { getActor } from '@/lib/auth/actor'
import { QueueClient } from './_components/QueueClient'
import type { QueueRequest } from '@/components/approval/QueueDashboard'

export default async function ApprovalsPage() {
  const actor = await getActor()
  const { requests, counts } = await approvalService.listQueueForDashboard()

  const serialized: QueueRequest[] = requests.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    status: r.status,
    priorityScore: r.priorityScore,
    requester: r.requester,
    assignee: r.assignee,
    lockedAt: r.lockedAt?.toISOString() ?? null,
    lockExpiresAt: r.lockExpiresAt?.toISOString() ?? null,
    submittedAt: r.submittedAt.toISOString(),
  }))

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Approval Queue</h1>
      <QueueClient
        initialRequests={serialized}
        initialCounts={counts}
        currentUserId={actor.id}
      />
    </main>
  )
}
