import Pusher from 'pusher'

export type ApprovalEventName =
  | 'request:submitted'
  | 'request:locked'
  | 'request:unlocked'
  | 'request:approved'
  | 'request:rejected'
  | 'queue:counts'

export const APPROVAL_CHANNEL = 'approval-queue'

function createPusherServer(): Pusher | null {
  const { PUSHER_APP_ID, PUSHER_APP_KEY, PUSHER_APP_SECRET } = process.env
  if (!PUSHER_APP_ID || !PUSHER_APP_KEY || !PUSHER_APP_SECRET) {
    return null
  }
  return new Pusher({
    appId: PUSHER_APP_ID,
    key: PUSHER_APP_KEY,
    secret: PUSHER_APP_SECRET,
    host: process.env.PUSHER_HOST ?? 'localhost',
    port: process.env.PUSHER_PORT ?? '6001',
    useTLS: false,
  })
}

export const pusherServer = createPusherServer()

export async function triggerApprovalEvent(
  event: ApprovalEventName,
  data: Record<string, unknown>
): Promise<void> {
  if (!pusherServer) {
    console.warn(`[pusherServer] Skipping event "${event}" — PUSHER_APP_* env vars not set`)
    return
  }
  try {
    await pusherServer.trigger(APPROVAL_CHANNEL, event, data)
  } catch (err) {
    console.error(`[pusherServer] Failed to trigger "${event}":`, err)
  }
}
