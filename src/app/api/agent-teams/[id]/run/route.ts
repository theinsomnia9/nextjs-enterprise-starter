import { withApi } from '@/lib/api/withApi'
import { getActor } from '@/lib/auth/actor'
import { validationError } from '@/lib/errors/AppError'
import { runTeamSchema } from '@/lib/agentTeams/schemas'
import { agentTeamService } from '@/services/agentTeamService'
import { executeTeam } from '@/lib/agentTeams/executor'
import { SSE_HEADERS, SSE_DONE_FRAME } from '@/lib/sse/eventTypes'

export const POST = withApi<{ id: string }>('agentTeams.run', async (req, { params }) => {
  const { id } = await params
  const actor = await getActor()
  const body = await req.json()
  const parsed = runTeamSchema.safeParse(body)
  if (!parsed.success) throw validationError(parsed.error.issues[0].message)

  const team = await agentTeamService.get(id, actor.id)

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }
      try {
        for await (const ev of executeTeam({
          teamId: team.id,
          definition: team.definition,
          input: parsed.data.input,
          signal: req.signal,
        })) {
          send(ev)
          if (ev.type === 'final' || ev.type === 'error') break
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Execution failed'
        send({ type: 'error', message })
      } finally {
        controller.enqueue(encoder.encode(SSE_DONE_FRAME))
        controller.close()
      }
    },
  })

  return new Response(stream, { headers: SSE_HEADERS })
})
