import { getChatModel, chatModelName } from '@/lib/ai'
import { createSpan, createHistogram, createCounter, logger } from '@/lib/telemetry'
import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages'
import { z } from 'zod'
import type { GraphDiff, TeamDefinition } from './types'
import { listTools } from './toolRegistry'
import { listNodeSpecs } from './nodeRegistry'

const nodeKinds = z.enum(['trigger', 'agent', 'tool', 'guardrail', 'output'])

const nodeDataSchema = z.object({
  kind: nodeKinds,
  label: z.string(),
  description: z.string().nullable(),
  role: z.string().nullable(),
  systemPrompt: z.string().nullable(),
  model: z.string().nullable(),
  temperature: z.number().nullable(),
  toolNames: z.array(z.string()).nullable(),
  maxTurns: z.number().nullable(),
  toolName: z.string().nullable(),
  guardrailKind: z.enum(['relevance', 'blocklist', 'length']).nullable(),
  blocklist: z.array(z.string()).nullable(),
  maxLength: z.number().nullable(),
  topic: z.string().nullable(),
  format: z.enum(['text', 'json', 'markdown']).nullable(),
})

const nodeDataPatchSchema = z.object({
  kind: nodeKinds.nullable(),
  label: z.string().nullable(),
  description: z.string().nullable(),
  role: z.string().nullable(),
  systemPrompt: z.string().nullable(),
  model: z.string().nullable(),
  temperature: z.number().nullable(),
  toolNames: z.array(z.string()).nullable(),
  maxTurns: z.number().nullable(),
  toolName: z.string().nullable(),
  guardrailKind: z.enum(['relevance', 'blocklist', 'length']).nullable(),
  blocklist: z.array(z.string()).nullable(),
  maxLength: z.number().nullable(),
  topic: z.string().nullable(),
  format: z.enum(['text', 'json', 'markdown']).nullable(),
})

const diffSchema = z.object({
  rationale: z.string().describe('One or two sentences explaining what you changed and why.'),
  ops: z
    .array(
      z.union([
        z.object({
          op: z.literal('add_node'),
          node: z.object({
            id: z.string(),
            type: nodeKinds,
            position: z.object({ x: z.number(), y: z.number() }),
            data: nodeDataSchema,
          }),
        }),
        z.object({
          op: z.literal('patch_node'),
          id: z.string(),
          data: nodeDataPatchSchema,
        }),
        z.object({ op: z.literal('remove_node'), id: z.string() }),
        z.object({
          op: z.literal('add_edge'),
          edge: z.object({
            id: z.string(),
            source: z.string(),
            target: z.string(),
            label: z.string().nullable(),
            animated: z.boolean().nullable(),
          }),
        }),
        z.object({ op: z.literal('remove_edge'), id: z.string() }),
        z.object({
          op: z.literal('set_metadata'),
          metadata: z.object({
            title: z.string().nullable(),
            description: z.string().nullable(),
          }),
        }),
      ])
    )
    .describe('Ordered list of operations to apply to the current graph.'),
})

function stripNulls<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripNulls(v)) as unknown as T
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === null) continue
      out[k] = stripNulls(v)
    }
    return out as T
  }
  return value
}

export type DesignerResponse = z.infer<typeof diffSchema>

export interface DesignerHistory {
  role: 'user' | 'assistant'
  content: string
}

function buildSystemPrompt(current: TeamDefinition): string {
  const toolList = listTools()
    .map((t) => `- ${t.name}: ${t.description}${t.placeholder ? ' (placeholder)' : ''}`)
    .join('\n')

  const nodeKindList = listNodeSpecs()
    .map((s) => `- ${s.kind}: ${s.description}`)
    .join('\n')

  return [
    'You are an expert AI workflow architect. Users describe a multi-agent system in plain language and you propose structured edits to a graph.',
    '',
    'NODE KINDS:',
    nodeKindList,
    '',
    'AVAILABLE TOOLS (use exact names on agent nodes):',
    toolList,
    '',
    'RULES:',
    '1. Return ONLY operations needed to reach the requested state. Do not re-send unchanged nodes.',
    '2. When adding nodes, generate unique ids like "agent-researcher" or "guardrail-safety".',
    '3. Position new nodes with non-overlapping coordinates. Lay the graph out left-to-right with ~240px horizontal spacing and ~160px vertical spacing.',
    '4. Always connect the graph from trigger → agents → output. Add explicit edges.',
    '5. For agent nodes, always include: role, systemPrompt (clear, numbered if multi-step), model (default gpt-4o-mini), temperature (0.2-0.7), toolNames, maxTurns (default 5).',
    '6. Use guardrail nodes to wrap inputs if the user mentions safety, PII, or content concerns.',
    '7. Keep rationale short (one or two sentences). Do not narrate every operation.',
    '',
    'CURRENT GRAPH STATE (JSON):',
    JSON.stringify(current, null, 2),
  ].join('\n')
}

const llmDuration = createHistogram('llm.call.duration', {
  description: 'Duration of LLM calls, labeled by provider/model/operation.',
  unit: 'ms',
})

const llmTokens = createCounter('llm.tokens.total', {
  description: 'LLM tokens consumed, labeled by provider/model/operation/direction.',
  unit: '1',
})

export interface DesignerDeps {
  model?: string
}

export async function runDesigner(
  input: {
    message: string
    current: TeamDefinition
    history?: DesignerHistory[]
  },
  deps: DesignerDeps = {}
): Promise<{ diff: GraphDiff; reply: string }> {
  return createSpan('team.designer.propose', async (span) => {
    const provider = process.env.LLM_PROVIDER || 'openai'
    const model = deps.model || chatModelName()
    const temperature = 0
    const operation = 'team_designer.propose'

    span.setAttribute('llm.provider', provider)
    span.setAttribute('llm.model', model)
    span.setAttribute('llm.temperature', temperature)

    const llm = getChatModel({
      model: deps.model,
      temperature,
    }).withStructuredOutput(diffSchema, { name: 'propose_graph_diff' })

    const messages = [
      new SystemMessage(buildSystemPrompt(input.current)),
      ...(input.history ?? []).map((m) =>
        m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
      ),
      new HumanMessage(input.message),
    ]

    const startedAt = performance.now()
    let parsed
    try {
      parsed = await llm.invoke(messages)
    } finally {
      const durationMs = performance.now() - startedAt
      llmDuration.record(durationMs, { provider, model, operation })
      logger.info('llm.call', {
        provider,
        model,
        operation,
        durationMs: Math.round(durationMs),
      })
    }

    const cleaned = stripNulls(parsed)
    const diff: GraphDiff = {
      ops: cleaned.ops as GraphDiff['ops'],
      rationale: cleaned.rationale,
    }
    // LangChain's withStructuredOutput doesn't surface token usage on the parsed output.
    // Token counting is a deliberate follow-up once we wire the raw AIMessage path.
    void llmTokens
    return { diff, reply: cleaned.rationale }
  })
}
