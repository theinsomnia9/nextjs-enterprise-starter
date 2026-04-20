import type { AgentTeamDetail, AgentTeamSummary, GraphDiff, TeamDefinition } from '@/lib/agentTeams/types'

export interface DesignResponse {
  diff: GraphDiff
  reply: string
  nextDefinition: TeamDefinition
  validation: { ok: boolean; issues: { level: 'error' | 'warning'; message: string }[] }
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const msg = body?.error ?? `Request failed (${res.status})`
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export async function listTeams(): Promise<AgentTeamSummary[]> {
  const { teams } = await jsonFetch<{ teams: AgentTeamSummary[] }>('/api/agent-teams')
  return teams
}

export async function getTeam(id: string): Promise<AgentTeamDetail> {
  return jsonFetch<AgentTeamDetail>(`/api/agent-teams/${id}`)
}

export async function createTeam(input: {
  name: string
  description?: string
}): Promise<AgentTeamDetail> {
  return jsonFetch<AgentTeamDetail>('/api/agent-teams', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateTeam(
  id: string,
  patch: {
    name?: string
    description?: string
    definition?: TeamDefinition
    isActive?: boolean
  }
): Promise<AgentTeamDetail> {
  return jsonFetch<AgentTeamDetail>(`/api/agent-teams/${id}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  })
}

export async function deleteTeam(id: string): Promise<void> {
  await jsonFetch<{ ok: true }>(`/api/agent-teams/${id}`, { method: 'DELETE' })
}

export async function designTeam(input: {
  message: string
  definition: TeamDefinition
  history?: { role: 'user' | 'assistant'; content: string }[]
}): Promise<DesignResponse> {
  return jsonFetch<DesignResponse>('/api/agent-teams/design', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
