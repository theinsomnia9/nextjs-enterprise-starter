import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { triggerApprovalEvent } from '@/lib/approvals/pusherServer'

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  const auth = req.headers.get('Authorization')

  if (!cronSecret || !auth || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  const result = await prisma.approvalRequest.updateMany({
    where: {
      status: 'REVIEWING',
      lockExpiresAt: { lt: now },
    },
    data: {
      status: 'PENDING',
      assigneeId: null,
      lockedAt: null,
      lockExpiresAt: null,
    },
  })

  if (result.count > 0) {
    await triggerApprovalEvent('queue:counts', { expiredCount: result.count })
  }

  return NextResponse.json({ released: result.count, timestamp: now.toISOString() })
}
