'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createTeam } from '@/lib/api/agentTeams'

export function NewTeamButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onClick() {
    setLoading(true)
    setError(null)
    try {
      const name = `New Team ${new Date().toLocaleTimeString()}`
      const team = await createTeam({ name })
      router.push(`/agent-teams/${team.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={onClick}
        disabled={loading}
        className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        data-testid="new-team-button"
      >
        {loading ? 'Creating…' : 'New Team'}
      </button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}
