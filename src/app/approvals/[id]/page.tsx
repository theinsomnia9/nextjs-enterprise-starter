import { notFound as nextNotFound } from 'next/navigation'
import { approvalService } from '@/services/approvalService'
import { AppError, ErrorCode } from '@/lib/errors/AppError'
import { DetailClient } from './_components/DetailClient'
import type { QueueRequest } from '@/components/approval/QueueDashboard'

interface ApprovalDetailPageProps {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export default async function ApprovalDetailPage({ params }: ApprovalDetailPageProps) {
  const { id } = await params

  let request: Awaited<ReturnType<typeof approvalService.getRequestWithScore>>
  try {
    request = await approvalService.getRequestWithScore(id)
  } catch (err) {
    if (err instanceof AppError && err.code === ErrorCode.NOT_FOUND) {
      nextNotFound()
    }
    throw err
  }

  const serialized: QueueRequest = {
    id: request.id,
    title: request.title,
    category: request.category,
    status: request.status,
    priorityScore: request.priorityScore,
    requester: request.requester,
    assignee: request.assignee,
    lockedAt: request.lockedAt?.toISOString() ?? null,
    lockExpiresAt: request.lockExpiresAt?.toISOString() ?? null,
    submittedAt: request.submittedAt.toISOString(),
  }

  return <DetailClient request={serialized} />
}
