import { notFound as nextNotFound } from 'next/navigation'
import { approvalService } from '@/services/approvalService'
import { AppError, ErrorCode } from '@/lib/errors/AppError'
import { DetailClient } from './_components/DetailClient'
import { toQueueRequest } from '@/lib/approvals/serialize'

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

  return <DetailClient request={toQueueRequest(request)} />
}
