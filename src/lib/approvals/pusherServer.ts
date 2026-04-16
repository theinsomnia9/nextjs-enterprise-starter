import Pusher from 'pusher'

export type ApprovalEventName =
  | 'request:submitted'
  | 'request:locked'
  | 'request:unlocked'
  | 'request:approved'
  | 'request:rejected'
  | 'queue:counts'

export const APPROVAL_CHANNEL = 'approval-queue'

export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_APP_KEY!,
  secret: process.env.PUSHER_APP_SECRET!,
  host: process.env.PUSHER_HOST ?? 'localhost',
  port: process.env.PUSHER_PORT ?? '6001',
  useTLS: false,
})

export async function triggerApprovalEvent(
  event: ApprovalEventName,
  data: Record<string, unknown>
): Promise<void> {
  await pusherServer.trigger(APPROVAL_CHANNEL, event, data)
}
