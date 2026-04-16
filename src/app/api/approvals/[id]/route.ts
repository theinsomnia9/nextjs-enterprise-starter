import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSpan } from '@/lib/telemetry/tracing'
import { calculatePriorityScore } from '@/lib/approvals/priorityScore'
import type { PriorityConfigValues } from '@/lib/approvals/types'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return createSpan('approvals.get', async () => {
    const { id } = params

    const [request, configs] = await Promise.all([
      prisma.approvalRequest.findUnique({
        where: { id },
        include: {
          requester: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.priorityConfig.findMany(),
    ])

    if (!request) {
      return NextResponse.json({ error: 'Approval request not found' }, { status: 404 })
    }

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

    const cfg = configMap.get(request.category) ?? {
      baseWeight: 25,
      agingFactor: 0.5,
      slaHours: 120,
      lockTimeoutMinutes: 5,
    }

    return NextResponse.json({
      ...request,
      priorityScore: calculatePriorityScore(request.submittedAt, cfg),
    })
  }).catch((err: Error) => {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }) as Promise<NextResponse>
}
