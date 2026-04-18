import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSpan } from '@/lib/telemetry/tracing'
import { calculatePriorityScore, getDefaultPriorityConfig } from '@/lib/approvals/priorityScore'
import type { PriorityConfigValues } from '@/lib/approvals/types'

const DEFAULT_CONFIGS = new Map(
  getDefaultPriorityConfig().map((c) => [c.category, c as PriorityConfigValues])
)

export async function GET() {
  return createSpan('approvals.queue.get', async () => {
    const [requests, dbConfigs, statusGroups] = await Promise.all([
      prisma.approvalRequest.findMany({
        where: { status: { in: ['PENDING', 'REVIEWING'] } },
        include: {
          requester: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.priorityConfig.findMany(),
      prisma.approvalRequest.groupBy({ by: ['status'], _count: { id: true } }),
    ])

    const counts = { PENDING: 0, REVIEWING: 0, APPROVED: 0, REJECTED: 0 } as Record<string, number>
    statusGroups.forEach((g) => {
      counts[g.status] = g._count.id
    })

    const configMap = new Map<string, PriorityConfigValues>([
      ...DEFAULT_CONFIGS,
      ...dbConfigs.map((c) => [c.category, c as PriorityConfigValues] as const),
    ])

    const scored = requests
      .map((r) => ({
        ...r,
        priorityScore: calculatePriorityScore(r.submittedAt, configMap.get(r.category)!),
      }))
      .sort((a, b) => b.priorityScore - a.priorityScore)

    return NextResponse.json({ requests: scored, total: scored.length, counts })
  })
}
