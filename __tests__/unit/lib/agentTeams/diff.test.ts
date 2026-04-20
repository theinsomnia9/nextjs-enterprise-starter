import { describe, it, expect } from 'vitest'
import { applyDiff } from '@/lib/agentTeams/diff'
import { emptyDefinition } from '@/lib/agentTeams/validator'
import type { GraphDiff } from '@/lib/agentTeams/types'

describe('applyDiff', () => {
  it('adds a node', () => {
    const def = emptyDefinition('T')
    const diff: GraphDiff = {
      rationale: 'add agent',
      ops: [
        {
          op: 'add_node',
          node: {
            id: 'agent-1',
            type: 'agent',
            position: { x: 300, y: 160 },
            data: {
              kind: 'agent',
              label: 'Writer',
              role: 'Writer',
              systemPrompt: 'write',
              model: 'gpt-4o-mini',
              temperature: 0.3,
              toolNames: [],
              maxTurns: 3,
            },
          },
        },
      ],
    }
    const next = applyDiff(def, diff)
    expect(next.nodes.find((n) => n.id === 'agent-1')?.data.label).toBe('Writer')
  })

  it('patches an existing node', () => {
    const def = emptyDefinition('T')
    const diff: GraphDiff = {
      rationale: 'rename',
      ops: [{ op: 'patch_node', id: 'trigger-1', data: { label: 'Start' } }],
    }
    const next = applyDiff(def, diff)
    expect(next.nodes.find((n) => n.id === 'trigger-1')?.data.label).toBe('Start')
  })

  it('ignores patch_node that attempts to change kind', () => {
    const def = emptyDefinition('T')
    const diff: GraphDiff = {
      rationale: 'bad',
      ops: [{ op: 'patch_node', id: 'trigger-1', data: { kind: 'agent' } as never }],
    }
    const next = applyDiff(def, diff)
    expect(next.nodes.find((n) => n.id === 'trigger-1')?.data.kind).toBe('trigger')
  })

  it('removes a node and its incident edges', () => {
    const def = emptyDefinition('T')
    const diff: GraphDiff = {
      rationale: 'x',
      ops: [{ op: 'remove_node', id: 'trigger-1' }],
    }
    const next = applyDiff(def, diff)
    expect(next.nodes.find((n) => n.id === 'trigger-1')).toBeUndefined()
    expect(next.edges.find((e) => e.source === 'trigger-1' || e.target === 'trigger-1')).toBeUndefined()
  })

  it('adds and removes edges', () => {
    const def = emptyDefinition('T')
    const diff: GraphDiff = {
      rationale: 'reshape',
      ops: [
        { op: 'remove_edge', id: 'e-trigger-output' },
        { op: 'add_edge', edge: { id: 'new', source: 'trigger-1', target: 'output-1' } },
      ],
    }
    const next = applyDiff(def, diff)
    expect(next.edges.find((e) => e.id === 'e-trigger-output')).toBeUndefined()
    expect(next.edges.find((e) => e.id === 'new')).toBeTruthy()
  })

  it('patches metadata', () => {
    const def = emptyDefinition('T')
    const diff: GraphDiff = {
      rationale: 'title',
      ops: [{ op: 'set_metadata', metadata: { title: 'Research Team' } }],
    }
    const next = applyDiff(def, diff)
    expect(next.metadata.title).toBe('Research Team')
  })

  it('does not duplicate an already-present node', () => {
    const def = emptyDefinition('T')
    const diff: GraphDiff = {
      rationale: 'dup',
      ops: [
        {
          op: 'add_node',
          node: {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { kind: 'trigger', label: 'dup' },
          },
        },
      ],
    }
    const next = applyDiff(def, diff)
    expect(next.nodes.filter((n) => n.id === 'trigger-1')).toHaveLength(1)
  })
})
