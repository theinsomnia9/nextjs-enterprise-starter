import type { TeamDefinition } from './types'
import { TOOL_REGISTRY } from './toolRegistry'

export interface ValidationIssue {
  level: 'error' | 'warning'
  message: string
  nodeId?: string
  edgeId?: string
}

export interface ValidationReport {
  ok: boolean
  issues: ValidationIssue[]
}

export function validateTeamDefinition(def: TeamDefinition): ValidationReport {
  const issues: ValidationIssue[] = []
  const nodeIds = new Set(def.nodes.map((n) => n.id))

  const triggers = def.nodes.filter((n) => n.type === 'trigger')
  const outputs = def.nodes.filter((n) => n.type === 'output')
  const agents = def.nodes.filter((n) => n.type === 'agent')

  if (triggers.length === 0) {
    issues.push({ level: 'error', message: 'Team must have at least one trigger node.' })
  }
  if (triggers.length > 1) {
    issues.push({
      level: 'warning',
      message: 'Multiple trigger nodes detected; only the first will be used at runtime.',
    })
  }
  if (outputs.length === 0) {
    issues.push({ level: 'error', message: 'Team must have at least one output node.' })
  }
  if (agents.length === 0) {
    issues.push({
      level: 'warning',
      message: 'Team has no agents; the output will just echo the input.',
    })
  }

  for (const edge of def.edges) {
    if (!nodeIds.has(edge.source)) {
      issues.push({
        level: 'error',
        edgeId: edge.id,
        message: `Edge "${edge.id}" references missing source node "${edge.source}".`,
      })
    }
    if (!nodeIds.has(edge.target)) {
      issues.push({
        level: 'error',
        edgeId: edge.id,
        message: `Edge "${edge.id}" references missing target node "${edge.target}".`,
      })
    }
  }

  for (const node of def.nodes) {
    if (node.data.kind !== node.type) {
      issues.push({
        level: 'error',
        nodeId: node.id,
        message: `Node "${node.id}" has mismatched type/data kind (${node.type} vs ${node.data.kind}).`,
      })
    }
    if (node.data.kind === 'agent') {
      for (const tn of node.data.toolNames) {
        if (!TOOL_REGISTRY[tn]) {
          issues.push({
            level: 'warning',
            nodeId: node.id,
            message: `Agent "${node.data.label}" references unknown tool "${tn}".`,
          })
        }
      }
    }
  }

  if (hasCycle(def)) {
    issues.push({
      level: 'error',
      message: 'Graph contains a cycle. The execution engine requires a DAG.',
    })
  }

  return { ok: !issues.some((i) => i.level === 'error'), issues }
}

function hasCycle(def: TeamDefinition): boolean {
  const outgoing = new Map<string, string[]>()
  for (const n of def.nodes) outgoing.set(n.id, [])
  for (const e of def.edges) {
    if (outgoing.has(e.source)) outgoing.get(e.source)!.push(e.target)
  }
  const WHITE = 0
  const GRAY = 1
  const BLACK = 2
  const color = new Map<string, number>()
  for (const n of def.nodes) color.set(n.id, WHITE)

  function dfs(id: string): boolean {
    color.set(id, GRAY)
    for (const next of outgoing.get(id) ?? []) {
      const c = color.get(next) ?? WHITE
      if (c === GRAY) return true
      if (c === WHITE && dfs(next)) return true
    }
    color.set(id, BLACK)
    return false
  }

  for (const n of def.nodes) {
    if ((color.get(n.id) ?? WHITE) === WHITE && dfs(n.id)) return true
  }
  return false
}

export function topologicalOrder(def: TeamDefinition): string[] {
  const incoming = new Map<string, number>()
  const outgoing = new Map<string, string[]>()
  for (const n of def.nodes) {
    incoming.set(n.id, 0)
    outgoing.set(n.id, [])
  }
  for (const e of def.edges) {
    if (!incoming.has(e.source) || !incoming.has(e.target)) continue
    incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1)
    outgoing.get(e.source)!.push(e.target)
  }

  const queue: string[] = []
  for (const [id, inc] of incoming) if (inc === 0) queue.push(id)

  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const next of outgoing.get(id) ?? []) {
      const newInc = (incoming.get(next) ?? 0) - 1
      incoming.set(next, newInc)
      if (newInc === 0) queue.push(next)
    }
  }
  return order
}

export function emptyDefinition(title: string): TeamDefinition {
  return {
    version: 1,
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        position: { x: 80, y: 160 },
        data: {
          kind: 'trigger',
          label: 'User Input',
          description: 'Receives the initial user message.',
        },
      },
      {
        id: 'output-1',
        type: 'output',
        position: { x: 560, y: 160 },
        data: { kind: 'output', label: 'Final Answer', format: 'markdown' },
      },
    ],
    edges: [{ id: 'e-trigger-output', source: 'trigger-1', target: 'output-1' }],
    metadata: { title },
  }
}
