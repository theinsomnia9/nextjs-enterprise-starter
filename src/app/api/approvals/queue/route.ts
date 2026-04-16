import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSpan } from '@/lib/telemetry/tracing'
import { calculatePriorityScore } from '@/lib/approvals/priorityScore'
import type { PriorityConfigValues } from '@/lib/approvals/types'

export async function GET() {
  return createSpan('approvals.queue.get', async () => {
    const [requests, configs, statusGroups] = await Promise.all([
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
    statusGroups.forEach((g) => { counts[g.status] = g._count.id })

    const configMap = new Map<string, PriorityConfigValues>(
      configs.map((c) => [
        c.category,
        {
          baseWeight: c.baseWeight,
          agingFactor: c.agingFactor,
          slaHours: c.slaHours,
          lockTimeoutMinutes: c.lockTimeoutMinutes,
        },
      ])
    )

    const scored = requests
      .map((r) => {
        const cfg = configMap.get(r.category) ?? {
          baseWeight: 25,
          agingFactor: 0.5,
          slaHours: 120,
          lockTimeoutMinutes: 5,
        }
        return { ...r, priorityScore: calculatePriorityScore(r.submittedAt, cfg) }
      })
      .sort((a, b) => b.priorityScore - a.priorityScore)

    return NextResponse.json({ requests: scored, total: scored.length, counts })
  }) as Promise<NextResponse>
}
