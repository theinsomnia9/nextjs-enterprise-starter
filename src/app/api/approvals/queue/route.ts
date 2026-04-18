import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSpan } from '@/lib/telemetry/tracing'
import { approvalService } from '@/services/approvalService'
import { handleApiError } from '@/lib/errors/handler'
import { calculatePriorityScore } from '@/lib/approvals/priorityScore'

export async function GET() {
  return createSpan('approvals.queue.get', async () => {
    const [{ requests, configs }, statusGroups] = await Promise.all([
      approvalService.getQueueWithConfigs(),
      prisma.approvalRequest.groupBy({ by: ['status'], _count: { id: true } }),
    ])

    const counts = { PENDING: 0, REVIEWING: 0, APPROVED: 0, REJECTED: 0 } as Record<string, number>
    statusGroups.forEach((g) => { counts[g.status] = g._count.id })

    const scored = requests
      .map((r) => ({ ...r, priorityScore: calculatePriorityScore(r.submittedAt, r.config) }))
      .sort((a, b) => b.priorityScore - a.priorityScore)

    return NextResponse.json({ requests: scored, total: scored.length, counts, configs })
  }).catch(handleApiError)
}
