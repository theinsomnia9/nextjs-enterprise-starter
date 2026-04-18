import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSpan } from '@/lib/telemetry/tracing'
import { calculatePriorityScore, getDefaultPriorityConfig } from '@/lib/approvals/priorityScore'
import type { PriorityConfigValues } from '@/lib/approvals/types'

const DEFAULT_CONFIGS = new Map(
  getDefaultPriorityConfig().map((c) => [c.category, c as PriorityConfigValues])
)

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return createSpan('approvals.get', async () => {
    const { id } = await params

    const [request, dbConfigs] = await Promise.all([
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

    const configMap = new Map<string, PriorityConfigValues>([
      ...DEFAULT_CONFIGS,
      ...dbConfigs.map((c) => [c.category, c as PriorityConfigValues] as const),
    ])

    return NextResponse.json({
      ...request,
      priorityScore: calculatePriorityScore(request.submittedAt, configMap.get(request.category)!),
    })
  }).catch((err: Error) => NextResponse.json({ error: err.message }, { status: 500 }))
}
