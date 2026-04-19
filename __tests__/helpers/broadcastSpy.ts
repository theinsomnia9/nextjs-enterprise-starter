import { vi } from 'vitest'
import * as sseServer from '@/lib/approvals/sseServer'

export function spyOnBroadcast() {
  return vi.spyOn(sseServer, 'broadcastApprovalEvent').mockResolvedValue()
}
