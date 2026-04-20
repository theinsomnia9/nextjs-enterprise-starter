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

  it('warns (not errors) when there are multiple triggers', () => {
    const def = emptyDefinition('t')
    def.nodes.push({
      id: 'trigger-2',
      type: 'trigger',
      position: { x: 0, y: 0 },
      data: { kind: 'trigger', label: 'Alt' },
    })
    const report = validateTeamDefinition(def)
    expect(report.ok).toBe(true)
    const warn = report.issues.find((i) => i.message.includes('Multiple trigger'))
    expect(warn).toBeDefined()
    expect(warn!.level).toBe('warning')
  })

  it('warns (not errors) when there are no agents', () => {
    const def = emptyDefinition('t')
    const report = validateTeamDefinition(def)
    expect(report.ok).toBe(true)
    const warn = report.issues.find((i) => i.message.includes('no agents'))
    expect(warn).toBeDefined()
    expect(warn!.level).toBe('warning')
  })

  it('errors when node.type and node.data.kind disagree', () => {
    const def = makeDef({
      nodes: [
        {
          id: 't',
          type: 'trigger',
          position: { x: 0, y: 0 },
          data: { kind: 'trigger', label: 't' },
        },
        {
          // type says agent, data.kind says output — the executor would blow up
          id: 'mismatch',
          type: 'agent',
          position: { x: 100, y: 0 },
          data: { kind: 'output', label: 'x', format: 'text' } as never,
        },
        {
          id: 'o',
          type: 'output',
          position: { x: 200, y: 0 },
          data: { kind: 'output', label: 'o', format: 'text' },
        },
      ],
    })
    const report = validateTeamDefinition(def)
    expect(report.ok).toBe(false)
    const err = report.issues.find((i) => i.nodeId === 'mismatch')
    expect(err).toBeDefined()
    expect(err!.message).toMatch(/mismatched type\/data kind/)
  })

  it('passes an agent that uses a known tool without warnings about tools', () => {
    const def = makeDef({
      nodes: [
        { id: 't', type: 'trigger', position: { x: 0, y: 0 }, data: { kind: 'trigger', label: 't' } },
        {
          id: 'a',
          type: 'agent',
          position: { x: 100, y: 0 },
          data: {
            kind: 'agent',
            label: 'Researcher',
            role: 'r',
            systemPrompt: 'x',
            model: 'gpt-4o-mini',
            temperature: 0.2,
            toolNames: ['tavily_search', 'calculator'],
            maxTurns: 3,
          },
        },
        { id: 'o', type: 'output', position: { x: 200, y: 0 }, data: { kind: 'output', label: 'o', format: 'text' } },
      ],
      edges: [
        { id: 'e1', source: 't', target: 'a' },
        { id: 'e2', source: 'a', target: 'o' },
      ],
    })
    const report = validateTeamDefinition(def)
    expect(report.ok).toBe(true)
    expect(report.issues.some((i) => i.message.includes('unknown tool'))).toBe(false)
  })

  it('detects a self-loop as a cycle', () => {
    const def = emptyDefinition('t')
    def.edges.push({ id: 'self', source: 'trigger-1', target: 'trigger-1' })
    const report = validateTeamDefinition(def)
    expect(report.ok).toBe(false)
    expect(report.issues.some((i) => i.message.toLowerCase().includes('cycle'))).toBe(true)
  })

  it('flags both missing source and missing target on the same edge', () => {
    const def = emptyDefinition('t')
    def.edges.push({ id: 'ghost', source: 'nope', target: 'also-nope' })
    const report = validateTeamDefinition(def)
    expect(report.ok).toBe(false)
    const edgeIssues = report.issues.filter((i) => i.edgeId === 'ghost')
    expect(edgeIssues).toHaveLength(2)
    expect(edgeIssues.some((i) => i.message.includes('source'))).toBe(true)
    expect(edgeIssues.some((i) => i.message.includes('target'))).toBe(true)
  })

  it('aggregates multiple independent issues in one report', () => {
    // no trigger, no output, cycle among two agent nodes, unknown tool
    const def = makeDef({
      nodes: [
        {
          id: 'a1',
          type: 'agent',
          position: { x: 0, y: 0 },
          data: {
            kind: 'agent',
            label: 'a1',
            role: 'r',
            systemPrompt: 'x',
            model: 'gpt-4o-mini',
            temperature: 0,
            toolNames: ['no_such_tool'],
            maxTurns: 1,
          },
        },
        {
          id: 'a2',
          type: 'agent',
          position: { x: 100, y: 0 },
          data: {
            kind: 'agent',
            label: 'a2',
            role: 'r',
            systemPrompt: 'x',
            model: 'gpt-4o-mini',
            temperature: 0,
            toolNames: [],
            maxTurns: 1,
          },
        },
      ],
      edges: [
        { id: 'c1', source: 'a1', target: 'a2' },
        { id: 'c2', source: 'a2', target: 'a1' },
      ],
    })
    const report = validateTeamDefinition(def)
    expect(report.ok).toBe(false)
    const messages = report.issues.map((i) => i.message).join(' | ')
    expect(messages).toMatch(/trigger/)
    expect(messages).toMatch(/output/)
    expect(messages.toLowerCase()).toMatch(/cycle/)
    expect(messages).toMatch(/no_such_tool/)
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
