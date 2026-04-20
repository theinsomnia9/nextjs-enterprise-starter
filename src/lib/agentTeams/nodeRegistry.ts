import type {
  AgentNodeData,
  AnyNodeData,
  GuardrailNodeData,
  NodeKind,
  OutputNodeData,
  ToolNodeData,
  TriggerNodeData,
} from './types'

export interface NodeKindSpec<T extends AnyNodeData = AnyNodeData> {
  kind: NodeKind
  label: string
  description: string
  defaults: () => T
  color: string
}

const trigger: NodeKindSpec<TriggerNodeData> = {
  kind: 'trigger',
  label: 'Trigger',
  description: 'Entry point that receives the user input.',
  color: '#10b981',
  defaults: () => ({
    kind: 'trigger',
    label: 'User Input',
    description: 'Receives initial message from the user.',
  }),
}

const agent: NodeKindSpec<AgentNodeData> = {
  kind: 'agent',
  label: 'Agent',
  description: 'LLM-powered worker with a role, instructions, and tools.',
  color: '#6366f1',
  defaults: () => ({
    kind: 'agent',
    label: 'Specialist Agent',
    role: 'Specialist',
    systemPrompt:
      'You are a specialist agent. Follow the instructions carefully, use tools when needed, and respond concisely.',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    toolNames: [],
    maxTurns: 5,
  }),
}

const tool: NodeKindSpec<ToolNodeData> = {
  kind: 'tool',
  label: 'Tool',
  description: 'External capability an agent can call.',
  color: '#f59e0b',
  defaults: () => ({
    kind: 'tool',
    label: 'Tool',
    toolName: 'calculator',
  }),
}

const guardrail: NodeKindSpec<GuardrailNodeData> = {
  kind: 'guardrail',
  label: 'Guardrail',
  description: 'Input/output check that can stop the run.',
  color: '#ef4444',
  defaults: () => ({
    kind: 'guardrail',
    label: 'Safety Check',
    guardrailKind: 'blocklist',
    blocklist: ['password', 'ssn'],
  }),
}

const output: NodeKindSpec<OutputNodeData> = {
  kind: 'output',
  label: 'Output',
  description: 'Terminal node that delivers the final result.',
  color: '#0ea5e9',
  defaults: () => ({
    kind: 'output',
    label: 'Final Answer',
    format: 'markdown',
  }),
}

export const NODE_REGISTRY: Record<NodeKind, NodeKindSpec> = {
  trigger,
  agent: agent as unknown as NodeKindSpec,
  tool: tool as unknown as NodeKindSpec,
  guardrail: guardrail as unknown as NodeKindSpec,
  output: output as unknown as NodeKindSpec,
}

export function getNodeSpec(kind: NodeKind): NodeKindSpec {
  return NODE_REGISTRY[kind]
}

export function listNodeSpecs(): NodeKindSpec[] {
  return Object.values(NODE_REGISTRY)
}
