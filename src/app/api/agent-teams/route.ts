import { NextResponse } from 'next/server'
import { withApi } from '@/lib/api/withApi'
import { getActor } from '@/lib/auth/actor'
import { validationError } from '@/lib/errors/AppError'
import { createTeamSchema } from '@/lib/agentTeams/schemas'
import { agentTeamService } from '@/services/agentTeamService'

export const GET = withApi('agentTeams.list', async () => {
  const actor = await getActor()
  const teams = await agentTeamService.list(actor.id)
  return NextResponse.json({ teams })
})

export const POST = withApi('agentTeams.create', async (req) => {
  const actor = await getActor()
  const body = await req.json()
  const parsed = createTeamSchema.safeParse(body)
  if (!parsed.success) throw validationError(parsed.error.issues[0].message)

  const team = await agentTeamService.create({
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    definition: parsed.data.definition,
    createdById: actor.id,
  })

  return NextResponse.json(team, { status: 201 })
})
