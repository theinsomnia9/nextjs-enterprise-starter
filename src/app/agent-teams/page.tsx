import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getActor } from '@/lib/auth/actor'
import { agentTeamService } from '@/services/agentTeamService'
import { NewTeamButton } from './_components/NewTeamButton'
import { DeleteTeamButton } from './_components/DeleteTeamButton'

export const dynamic = 'force-dynamic'

export default async function AgentTeamsPage() {
  const actor = await getActor().catch(() => null)
  if (!actor) redirect('/auth/signin?returnTo=/agent-teams')

  const teams = await agentTeamService.list(actor.id)

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-8" data-testid="agent-teams-page">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Agent Teams</h1>
          <p className="text-sm text-muted-foreground">
            Design multi-agent workflows visually, refine through structured forms,
            and run them on demand.
          </p>
        </div>
        <NewTeamButton />
      </header>

      {teams.length === 0 ? (
        <div
          className="rounded border border-dashed p-8 text-center text-sm text-muted-foreground"
          data-testid="empty-state"
        >
          No teams yet. Create your first team to start designing.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {teams.map((t) => (
            <li
              key={t.id}
              className="group rounded-lg border bg-card p-4 shadow-sm transition hover:border-primary"
              data-testid="team-card"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/agent-teams/${t.id}`}
                    className="block truncate text-base font-semibold hover:underline"
                  >
                    {t.name}
                  </Link>
                  {t.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {t.description}
                    </p>
                  )}
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Updated {new Date(t.updatedAt).toLocaleString()}
                  </p>
                </div>
                <DeleteTeamButton teamId={t.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
