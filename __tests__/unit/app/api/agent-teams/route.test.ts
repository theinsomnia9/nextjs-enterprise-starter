import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActor, clearActor } from '../../../../helpers/mockActor'

vi.mock('@/services/agentTeamService', () => ({
  agentTeamService: {
    list: vi.fn(),
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

import { GET, POST } from '@/app/api/agent-teams/route'
import { agentTeamService } from '@/services/agentTeamService'

const svc = vi.mocked(agentTeamService)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/agent-teams', () => {
  it('returns 401 when unauthenticated', async () => {
    await clearActor()
    const res = await GET(new Request('http://test/api/agent-teams'), {
      params: Promise.resolve({}),
    })
    expect(res.status).toBe(401)
  })

  it('returns the authenticated user teams', async () => {
    await setActor('owner-1')
    svc.list.mockResolvedValue([])
    const res = await GET(new Request('http://test/api/agent-teams'), {
      params: Promise.resolve({}),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.teams).toEqual([])
    expect(svc.list).toHaveBeenCalledWith('owner-1')
  })
})

describe('POST /api/agent-teams', () => {
  it('returns 400 on missing name', async () => {
    await setActor('owner-1')
    const res = await POST(
      new Request('http://test/api/agent-teams', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({}) }
    )
    expect(res.status).toBe(400)
  })

  it('creates a team for the authenticated user', async () => {
    await setActor('owner-1')
    svc.create.mockResolvedValue({
      id: 'new',
      name: 'T',
      description: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdById: 'owner-1',
      definition: {
        version: 1,
        nodes: [],
        edges: [],
        metadata: { title: 'T' },
      },
    })
    const res = await POST(
      new Request('http://test/api/agent-teams', {
        method: 'POST',
        body: JSON.stringify({ name: 'T' }),
      }),
      { params: Promise.resolve({}) }
    )
    expect(res.status).toBe(201)
    expect(svc.create).toHaveBeenCalled()
    const call = svc.create.mock.calls[0][0]
    expect(call.createdById).toBe('owner-1')
  })
})
