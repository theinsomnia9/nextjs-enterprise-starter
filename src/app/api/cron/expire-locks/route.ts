import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { triggerApprovalEvent } from '@/lib/approvals/pusherServer'

export async function GET(req: Request) {
  const auth = req.headers.get('Authorization')
  const expected = `Bearer ${process.env.CRON_SECRET}`

  if (!auth || auth !== expected) {
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
