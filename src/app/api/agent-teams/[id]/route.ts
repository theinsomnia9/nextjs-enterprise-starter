import { NextResponse } from 'next/server'
import { withApi } from '@/lib/api/withApi'
import { getActor } from '@/lib/auth/actor'
import { validationError } from '@/lib/errors/AppError'
import { updateTeamSchema } from '@/lib/agentTeams/schemas'
import { agentTeamService } from '@/services/agentTeamService'

export const GET = withApi<{ id: string }>('agentTeams.get', async (_req, { params }) => {
  const { id } = await params
  const actor = await getActor()
  const team = await agentTeamService.get(id, actor.id)
  return NextResponse.json(team)
})

export const PUT = withApi<{ id: string }>('agentTeams.update', async (req, { params }) => {
  const { id } = await params
  const actor = await getActor()
  const body = await req.json()
  const parsed = updateTeamSchema.safeParse(body)
  if (!parsed.success) throw validationError(parsed.error.issues[0].message)

  const team = await agentTeamService.update(id, actor.id, parsed.data)
  return NextResponse.json(team)
})

export const DELETE = withApi<{ id: string }>('agentTeams.delete', async (_req, { params }) => {
  const { id } = await params
  const actor = await getActor()
  await agentTeamService.delete(id, actor.id)
  return NextResponse.json({ ok: true })
})
