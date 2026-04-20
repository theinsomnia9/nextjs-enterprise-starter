export type NodeKind = 'trigger' | 'agent' | 'tool' | 'guardrail' | 'output'

export interface NodePosition {
  x: number
  y: number
}

export interface TriggerNodeData {
  kind: 'trigger'
  label: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export interface AgentNodeData {
  kind: 'agent'
  label: string
  description?: string
  role: string
  systemPrompt: string
  model: string
  temperature: number
  toolNames: string[]
  maxTurns: number
}

export interface ToolNodeData {
  kind: 'tool'
  label: string
  description?: string
  toolName: string
  config?: Record<string, unknown>
}

export type GuardrailKind = 'relevance' | 'blocklist' | 'length'

export interface GuardrailNodeData {
  kind: 'guardrail'
  label: string
  description?: string
  guardrailKind: GuardrailKind
  blocklist?: string[]
  maxLength?: number
  topic?: string
}

export interface OutputNodeData {
  kind: 'output'
  label: string
  description?: string
  format: 'text' | 'json' | 'markdown'
}

export type AnyNodeData =
  | TriggerNodeData
  | AgentNodeData
  | ToolNodeData
  | GuardrailNodeData
  | OutputNodeData

export interface TeamNode<T extends AnyNodeData = AnyNodeData> {
  id: string
  type: NodeKind
  position: NodePosition
  data: T
}

export interface TeamEdge {
  id: string
  source: string
  target: string
  label?: string
  animated?: boolean
}

export interface TeamDefinition {
  version: 1
  nodes: TeamNode[]
  edges: TeamEdge[]
  metadata: {
    title: string
    description?: string
  }
}

export interface AgentTeamSummary {
  id: string
  name: string
  description: string | null
  isActive: boolean
  updatedAt: Date
  createdAt: Date
  createdById: string
}

export interface AgentTeamDetail extends AgentTeamSummary {
  definition: TeamDefinition
}

export type GraphDiffOp =
  | { op: 'add_node'; node: TeamNode }
  | { op: 'patch_node'; id: string; data: Partial<AnyNodeData> }
  | { op: 'remove_node'; id: string }
  | { op: 'add_edge'; edge: TeamEdge }
  | { op: 'remove_edge'; id: string }
  | { op: 'set_metadata'; metadata: Partial<TeamDefinition['metadata']> }

export interface GraphDiff {
  ops: GraphDiffOp[]
  rationale: string
}
