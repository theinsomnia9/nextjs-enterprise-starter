import type { GraphDiff, GraphDiffOp, TeamDefinition } from './types'

export function applyDiff(def: TeamDefinition, diff: GraphDiff): TeamDefinition {
  const next: TeamDefinition = {
    version: 1,
    nodes: def.nodes.map((n) => ({ ...n, data: { ...n.data } as typeof n.data })),
    edges: def.edges.map((e) => ({ ...e })),
    metadata: { ...def.metadata },
  }

  for (const op of diff.ops) {
    applyOp(next, op)
  }

  return next
}

function applyOp(def: TeamDefinition, op: GraphDiffOp): void {
  switch (op.op) {
    case 'add_node': {
      if (def.nodes.find((n) => n.id === op.node.id)) return
      def.nodes.push(op.node)
      return
    }
    case 'patch_node': {
      const target = def.nodes.find((n) => n.id === op.id)
      if (!target) return
      if (target.data.kind !== (op.data as { kind?: string }).kind && (op.data as { kind?: string }).kind) {
        return
      }
      target.data = { ...target.data, ...op.data } as typeof target.data
      return
    }
    case 'remove_node': {
      def.nodes = def.nodes.filter((n) => n.id !== op.id)
      def.edges = def.edges.filter((e) => e.source !== op.id && e.target !== op.id)
      return
    }
    case 'add_edge': {
      if (def.edges.find((e) => e.id === op.edge.id)) return
      def.edges.push(op.edge)
      return
    }
    case 'remove_edge': {
      def.edges = def.edges.filter((e) => e.id !== op.id)
      return
    }
    case 'set_metadata': {
      def.metadata = { ...def.metadata, ...op.metadata }
      return
    }
  }
}
