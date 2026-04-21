import { withApi } from '@/lib/api/withApi'
import { getActor } from '@/lib/auth/actor'
import { validationError } from '@/lib/errors/AppError'
import { runTeamSchema } from '@/lib/agentTeams/schemas'
import { agentTeamService } from '@/services/agentTeamService'
import { executeTeam } from '@/lib/agentTeams/executor'
import { SSE_HEADERS, SSE_DONE_FRAME } from '@/lib/sse/eventTypes'
import { createSpan, createCounter, createHistogram, logger, addSpanEvent } from '@/lib/telemetry'

const runTotal = createCounter('agent_team.run.total', {
  description: 'Agent team run completions, labeled by result.',
  unit: '1',
})

const runEvents = createCounter('agent_team.run.events.total', {
  description: 'Agent team run events emitted, labeled by event_type.',
  unit: '1',
})

const runDuration = createHistogram('agent_team.run.duration', {
  description: 'Duration of agent team runs.',
  unit: 'ms',
  advice: {
    explicitBucketBoundaries: [10, 50, 100, 250, 500, 1000, 2500, 5000, 15000, 30000, 60000, 150000, 300000],
  },
})

export const POST = withApi<{ id: string }>('agentTeams.run', async (req, { params }) => {
  const { id } = await params
  const actor = await getActor()
  const body = await req.json()
  const parsed = runTeamSchema.safeParse(body)
  if (!parsed.success) throw validationError(parsed.error.issues[0].message)

  const team = await agentTeamService.get(id, actor.id)

  return createSpan('team.run', async (span) => {
    const startedAt = performance.now()
    let runStatus: 'completed' | 'failed' | 'client_disconnect' = 'completed'
    let runResult: 'ok' | 'error' | 'client_disconnect' = 'ok'
    let sawError = false
    let completedNormally = false

    span.setAttribute('team.id', team.id)
    span.setAttribute('user.id', actor.id)
    span.setAttribute('node_count', team.definition.nodes.length)

    logger.info('agent_team.run.start', {
      teamId: team.id,
      userId: actor.id,
      nodeCount: team.definition.nodes.length,
    })

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
            runEvents.add(1, { event_type: ev.type })
            if (ev.type === 'node_started' || ev.type === 'node_completed' || ev.type === 'node_failed') {
              addSpanEvent(ev.type, { 'node.id': ev.nodeId })
            }
            send(ev)
            if (ev.type === 'error') {
              sawError = true
            }
            if (ev.type === 'final' || ev.type === 'error') {
              completedNormally = true
              break
            }
          }
        } catch (err) {
          sawError = true
          const message = err instanceof Error ? err.message : 'Execution failed'
          send({ type: 'error', message })
          logger.error(
            'agent_team.run failed',
            err instanceof Error ? err : new Error(String(err)),
            { teamId: team.id }
          )
        } finally {
          if (sawError) {
            runStatus = 'failed'
            runResult = 'error'
          } else if (!completedNormally && req.signal.aborted) {
            runStatus = 'client_disconnect'
            runResult = 'client_disconnect'
          }
          const durationMs = performance.now() - startedAt
          span.setAttribute('run.status', runStatus)
          span.setAttribute('run.duration_ms', Math.round(durationMs))
          runTotal.add(1, { result: runResult })
          runDuration.record(durationMs, { result: runResult })
          logger.info('agent_team.run.end', {
            teamId: team.id,
            result: runResult,
            durationMs: Math.round(durationMs),
          })
          controller.enqueue(encoder.encode(SSE_DONE_FRAME))
          controller.close()
        }
      },
    })

    return new Response(stream, { headers: SSE_HEADERS })
  })
})
