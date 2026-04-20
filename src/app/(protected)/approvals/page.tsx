import { approvalService } from '@/services/approvalService'
import { getActor } from '@/lib/auth/actor'
import { QueueClient } from './_components/QueueClient'
import { toQueueRequest } from '@/lib/approvals/serialize'

export const dynamic = 'force-dynamic'

export default async function ApprovalsPage() {
  const actor = await getActor()
  const { requests, counts } = await approvalService.listQueueForDashboard()

  const serialized = requests.map(toQueueRequest)

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
