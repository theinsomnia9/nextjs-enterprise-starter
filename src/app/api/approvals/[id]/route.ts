import { NextRequest, NextResponse } from 'next/server'
import { createSpan } from '@/lib/telemetry/tracing'
import { approvalService } from '@/services/approvalService'
import { handleApiError } from '@/lib/errors/handler'
import { calculatePriorityScore, getDefaultPriorityConfig } from '@/lib/approvals/priorityScore'
import type { PriorityConfigValues } from '@/lib/approvals/types'

const DEFAULT_CONFIGS = new Map(
  getDefaultPriorityConfig().map((c) => [c.category, c as PriorityConfigValues])
)

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return createSpan('approvals.get', async () => {
    const { id } = await params
    const { requests, configs } = await approvalService.getQueueWithConfigs()

    const configMap = new Map<string, PriorityConfigValues>([
      ...DEFAULT_CONFIGS,
      ...configs.map((c) => [c.category, c as PriorityConfigValues] as const),
    ])

    // Try active queue first; fall back to direct lookup for resolved requests
    const queued = requests.find((r) => r.id === id)
    if (queued) {
      return NextResponse.json({
        ...queued,
        priorityScore: calculatePriorityScore(queued.submittedAt, queued.config),
      })
    }

    const request = await approvalService.getRequest(id)
    return NextResponse.json({
      ...request,
      priorityScore: calculatePriorityScore(
        request.submittedAt,
        configMap.get(request.category) ?? { baseWeight: 25, agingFactor: 0.5, slaHours: 120, lockTimeoutMinutes: 5 }
      ),
    })
  }).catch(handleApiError)
}
