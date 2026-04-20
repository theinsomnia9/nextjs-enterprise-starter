'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { deleteTeam } from '@/lib/api/agentTeams'

export function DeleteTeamButton({ teamId }: { teamId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function onClick(e: React.MouseEvent) {
    e.preventDefault()
    if (!confirm('Delete this team? This cannot be undone.')) return
    setLoading(true)
    try {
      await deleteTeam(teamId)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
      setLoading(false)
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={loading}
      aria-label="Delete team"
      className="rounded border border-transparent px-2 py-1 text-xs text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:border-destructive hover:text-destructive"
    >
      {loading ? '…' : '✕'}
    </button>
  )
}
