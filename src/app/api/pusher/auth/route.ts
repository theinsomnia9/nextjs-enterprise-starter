import { NextRequest, NextResponse } from 'next/server'
import { pusherServer } from '@/lib/approvals/pusherServer'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const params = new URLSearchParams(body)
  const socketId = params.get('socket_id')
  const channelName = params.get('channel_name')

  if (!socketId || !channelName) {
    return NextResponse.json({ error: 'Missing socket_id or channel_name' }, { status: 400 })
  }

  // TODO: Replace with `const session = await auth(); userId = session.user.id`
  // once NextAuth is configured. x-user-id header is only safe in development.
  const userId = req.headers.get('x-user-id') ?? 'anonymous'
  const userName = req.headers.get('x-user-name') ?? 'Anonymous'

  const presenceData = {
    user_id: userId,
    user_info: { name: userName },
  }

  const authResponse = pusherServer.authorizeChannel(socketId, channelName, presenceData)
  return NextResponse.json(authResponse)
}
