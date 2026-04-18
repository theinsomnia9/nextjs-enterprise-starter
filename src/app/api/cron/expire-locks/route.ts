import { NextResponse } from 'next/server'
import { broadcastApprovalEvent } from '@/lib/approvals/sseServer'
import { approvalService } from '@/services/approvalService'

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  const auth = req.headers.get('Authorization')

  if (!cronSecret || !auth || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { count } = await approvalService.expireLocks()

  if (count > 0) {
    await broadcastApprovalEvent('queue:counts', { expiredCount: count })
  }

  return NextResponse.json({ released: count, timestamp: new Date().toISOString() })
}
