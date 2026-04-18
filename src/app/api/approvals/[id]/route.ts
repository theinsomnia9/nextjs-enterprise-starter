import { NextRequest, NextResponse } from 'next/server'
import { createSpan } from '@/lib/telemetry/tracing'
import { approvalService } from '@/services/approvalService'
import { handleApiError } from '@/lib/errors/handler'
import { calculatePriorityScore } from '@/lib/approvals/priorityScore'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return createSpan('approvals.get', async () => {
    const { id } = await params
    const request = await approvalService.getRequest(id)
    const config = await approvalService.getPriorityConfig(request.category)
    return NextResponse.json({
      ...request,
      priorityScore: calculatePriorityScore(request.submittedAt, config),
    })
  }).catch(handleApiError)
}
