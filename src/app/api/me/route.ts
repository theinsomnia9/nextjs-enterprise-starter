import { NextResponse } from 'next/server'
import { getSessionForClient } from '@/lib/auth/actor'
import { unauthorized } from '@/lib/errors/AppError'
import { handleApiError } from '@/lib/errors/handler'
import { createSpan } from '@/lib/telemetry/tracing'

export const runtime = 'nodejs'

export async function GET() {
  try {
    return await createSpan('api.me.get', async (span) => {
      const session = await getSessionForClient()
      if (!session) throw unauthorized()
      span.setAttribute('actor.id', session.userId)
      return NextResponse.json({
        id: session.userId,
        roles: session.roles,
        name: session.name,
        email: session.email,
        photoUrl: session.photoUrl,
      })
    })
  } catch (err) {
    return handleApiError(err)
  }
}
