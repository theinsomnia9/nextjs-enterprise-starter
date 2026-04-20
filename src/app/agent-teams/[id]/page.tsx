import { notFound, redirect } from 'next/navigation'
import { getActor } from '@/lib/auth/actor'
import { agentTeamService } from '@/services/agentTeamService'
import { AppError, ErrorCode } from '@/lib/errors/AppError'
import { AgentTeamBuilder } from '@/components/agentTeams/AgentTeamBuilder'

export const dynamic = 'force-dynamic'

export default async function AgentTeamBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const actor = await getActor().catch(() => null)
  if (!actor) redirect(`/auth/signin?returnTo=/agent-teams/${id}`)

  try {
    const team = await agentTeamService.get(id, actor.id)
    return (
      <main className="h-screen w-full">
        <AgentTeamBuilder team={team} />
      </main>
    )
  } catch (err) {
    if (err instanceof AppError && err.code === ErrorCode.NOT_FOUND) notFound()
    throw err
  }
}
