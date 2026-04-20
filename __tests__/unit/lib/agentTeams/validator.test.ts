import { describe, it, expect } from 'vitest'
import {
  emptyDefinition,
  topologicalOrder,
  validateTeamDefinition,
} from '@/lib/agentTeams/validator'
import type { TeamDefinition } from '@/lib/agentTeams/types'

function makeDef(partial: Partial<TeamDefinition>): TeamDefinition {
  return {
    version: 1,
    nodes: [],
    edges: [],
    metadata: { title: 'Test' },
    ...partial,
  }
}

describe('validateTeamDefinition', () => {
  it('passes for a minimal trigger→output graph', () => {
    const def = emptyDefinition('Blank')
    const report = validateTeamDefinition(def)
    expect(report.ok).toBe(true)
  })

  it('errors when there is no trigger', () => {
    const def = makeDef({
      nodes: [
        {
          id: 'o',
          type: 'output',
          position: { x: 0, y: 0 },
          data: { kind: 'output', label: 'out', format: 'markdown' },
        },
      ],
    })
    const report = validateTeamDefinition(def)
    expect(report.ok).toBe(false)
    expect(report.issues.some((i) => i.message.includes('trigger'))).toBe(true)
  })

  it('errors when there is no output', () => {
    const def = makeDef({
      nodes: [
        {
          id: 't',
          type: 'trigger',
          position: { x: 0, y: 0 },
          data: { kind: 'trigger', label: 't' },
        },
      ],
    })
    const report = validateTeamDefinition(def)
    expect(report.ok).toBe(false)
    expect(report.issues.some((i) => i.message.includes('output'))).toBe(true)
  })

  it('warns when agent references unknown tool', () => {
    const def = makeDef({
      nodes: [
        {
          id: 't',
          type: 'trigger',
          position: { x: 0, y: 0 },
          data: { kind: 'trigger', label: 't' },
        },
        {
          id: 'a',
          type: 'agent',
          position: { x: 100, y: 0 },
          data: {
            kind: 'agent',
            label: 'a',
            role: 'r',
            systemPrompt: 'hi',
            model: 'gpt-4o-mini',
            temperature: 0.3,
            toolNames: ['no_such_tool'],
            maxTurns: 3,
          },
        },
        {
          id: 'o',
          type: 'output',
          position: { x: 200, y: 0 },
          data: { kind: 'output', label: 'o', format: 'text' },
        },
      ],
      edges: [
        { id: 'e1', source: 't', target: 'a' },
        { id: 'e2', source: 'a', target: 'o' },
      ],
    })
    const report = validateTeamDefinition(def)
    expect(report.ok).toBe(true)
    expect(report.issues.some((i) => i.level === 'warning' && i.message.includes('no_such_tool'))).toBe(true)
  })

  it('errors when an edge references a missing node', () => {
    const def = emptyDefinition('t')
    def.edges.push({ id: 'bad', source: 'ghost', target: 'output-1' })
    const report = validateTeamDefinition(def)
    expect(report.ok).toBe(false)
    expect(report.issues.some((i) => i.edgeId === 'bad')).toBe(true)
  })

  it('errors on cycles', () => {
    const def = makeDef({
      nodes: [
        { id: 't', type: 'trigger', position: { x: 0, y: 0 }, data: { kind: 'trigger', label: 't' } },
        {
          id: 'a',
          type: 'agent',
          position: { x: 0, y: 0 },
          data: {
            kind: 'agent',
            label: 'a',
            role: 'r',
            systemPrompt: 'x',
            model: 'gpt-4o-mini',
            temperature: 0,
            toolNames: [],
            maxTurns: 1,
          },
        },
        { id: 'o', type: 'output', position: { x: 0, y: 0 }, data: { kind: 'output', label: 'o', format: 'text' } },
      ],
      edges: [
        { id: 'e1', source: 't', target: 'a' },
        { id: 'e2', source: 'a', target: 'o' },
        { id: 'e3', source: 'o', target: 'a' },
      ],
    })
    const report = validateTeamDefinition(def)
    expect(report.ok).toBe(false)
    expect(report.issues.some((i) => i.message.toLowerCase().includes('cycle'))).toBe(true)
  })
})

describe('topologicalOrder', () => {
  it('returns nodes in dependency order', () => {
    const def = emptyDefinition('t')
    const order = topologicalOrder(def)
    expect(order.indexOf('trigger-1')).toBeLessThan(order.indexOf('output-1'))
  })

  it('handles disconnected nodes', () => {
    const def = emptyDefinition('t')
    def.nodes.push({
      id: 'loner',
      type: 'agent',
      position: { x: 0, y: 0 },
      data: {
        kind: 'agent',
        label: 'x',
        role: 'r',
        systemPrompt: 'x',
        model: 'gpt-4o-mini',
        temperature: 0,
        toolNames: [],
        maxTurns: 1,
      },
    })
    const order = topologicalOrder(def)
    expect(order).toContain('loner')
    expect(order).toHaveLength(3)
  })
})
