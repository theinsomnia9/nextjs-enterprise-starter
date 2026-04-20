import { describe, it, expect } from 'vitest'
import { NODE_REGISTRY, getNodeSpec, listNodeSpecs } from '@/lib/agentTeams/nodeRegistry'

describe('nodeRegistry', () => {
  it('exposes all five kinds', () => {
    const kinds = listNodeSpecs().map((s) => s.kind)
    expect(kinds.sort()).toEqual(['agent', 'guardrail', 'output', 'tool', 'trigger'])
  })

  it('provides defaults whose data.kind matches spec.kind', () => {
    for (const spec of listNodeSpecs()) {
      const d = spec.defaults()
      expect(d.kind).toBe(spec.kind)
    }
  })

  it('agent defaults include a non-empty systemPrompt', () => {
    const d = NODE_REGISTRY.agent.defaults() as { systemPrompt: string }
    expect(d.systemPrompt.length).toBeGreaterThan(0)
  })

  it('getNodeSpec returns the matching spec', () => {
    expect(getNodeSpec('agent').kind).toBe('agent')
  })
})
