import { NextResponse } from 'next/server'
import { withApi } from '@/lib/api/withApi'
import { getActor } from '@/lib/auth/actor'
import { validationError } from '@/lib/errors/AppError'
import { designTeamSchema } from '@/lib/agentTeams/schemas'
import { runDesigner } from '@/lib/agentTeams/designer'
import { applyDiff } from '@/lib/agentTeams/diff'
import { validateTeamDefinition } from '@/lib/agentTeams/validator'
import { addSpanAttribute } from '@/lib/telemetry/tracing'

export const POST = withApi('agentTeams.design', async (req) => {
  await getActor()
  const body = await req.json()
  const parsed = designTeamSchema.safeParse(body)
  if (!parsed.success) throw validationError(parsed.error.errors[0].message)

  addSpanAttribute('design.message_length', parsed.data.message.length)

  const { diff, reply } = await runDesigner({
    message: parsed.data.message,
    current: parsed.data.definition,
    history: parsed.data.history,
  })

  const nextDefinition = applyDiff(parsed.data.definition, diff)
  const report = validateTeamDefinition(nextDefinition)

  return NextResponse.json({ diff, reply, nextDefinition, validation: report })
})
