import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createAgent } from 'langchain'
import type { AgentNodeData, GuardrailNodeData, TeamDefinition, TeamNode } from './types'
import { topologicalOrder, validateTeamDefinition } from './validator'
import { buildToolsForAgent } from './tools'
import { evaluateGuardrail } from './guardrails'

export type ExecutorEvent =
  | { type: 'run_started'; teamId: string }
  | { type: 'node_started'; nodeId: string; label: string; kind: string }
  | { type: 'node_completed'; nodeId: string; outputPreview: string }
  | { type: 'node_skipped'; nodeId: string; reason: string }
  | { type: 'node_failed'; nodeId: string; message: string }
  | { type: 'guardrail_tripped'; nodeId: string; reason: string }
  | { type: 'tool_call'; nodeId: string; tool: string; input: unknown }
  | { type: 'token'; content: string }
  | { type: 'final'; output: string }
  | { type: 'error'; message: string }

export interface ExecutorOptions {
  teamId: string
  definition: TeamDefinition
  input: string
  signal?: AbortSignal
  apiKey?: string
}

interface NodeResult {
  nodeId: string
  output: string
}

export async function* executeTeam(
  opts: ExecutorOptions
): AsyncGenerator<ExecutorEvent, void, unknown> {
  const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY
  if (!apiKey) {
    yield { type: 'error', message: 'OPENAI_API_KEY is not configured' }
    return
  }

  const report = validateTeamDefinition(opts.definition)
  if (!report.ok) {
    yield {
      type: 'error',
      message: `Invalid team definition: ${report.issues.map((i) => i.message).join('; ')}`,
    }
    return
  }

  yield { type: 'run_started', teamId: opts.teamId }

  const order = topologicalOrder(opts.definition)
  const byId = new Map(opts.definition.nodes.map((n) => [n.id, n]))
  const results = new Map<string, NodeResult>()

  const incomingOf = (id: string) => opts.definition.edges.filter((e) => e.target === id)

  let finalOutput = ''

  for (const id of order) {
    if (opts.signal?.aborted) {
      yield { type: 'error', message: 'aborted' }
      return
    }
    const node = byId.get(id)
    if (!node) continue

    const upstreamOutputs = incomingOf(id)
      .map((e) => results.get(e.source)?.output)
      .filter((v): v is string => typeof v === 'string' && v.length > 0)

    const combinedContext = upstreamOutputs.join('\n\n---\n\n')

    yield { type: 'node_started', nodeId: id, label: node.data.label, kind: node.type }

    try {
      if (node.type === 'trigger') {
        results.set(id, { nodeId: id, output: opts.input })
        yield {
          type: 'node_completed',
          nodeId: id,
          outputPreview: preview(opts.input),
        }
        continue
      }

      if (node.type === 'guardrail') {
        const data = node.data as GuardrailNodeData
        const toCheck = combinedContext || opts.input
        const result = evaluateGuardrail(toCheck, data)
        if (!result.ok) {
          yield { type: 'guardrail_tripped', nodeId: id, reason: result.reason ?? 'blocked' }
          yield { type: 'error', message: `Guardrail "${data.label}" blocked the run.` }
          return
        }
        results.set(id, { nodeId: id, output: toCheck })
        yield { type: 'node_completed', nodeId: id, outputPreview: 'passed' }
        continue
      }

      if (node.type === 'tool') {
        results.set(id, { nodeId: id, output: combinedContext })
        yield { type: 'node_skipped', nodeId: id, reason: 'Tools are invoked by agent nodes.' }
        continue
      }

      if (node.type === 'agent') {
        const result = await runAgentNode({
          node,
          apiKey,
          inputs: combinedContext || opts.input,
          signal: opts.signal,
          onEvent: () => undefined,
        })
        results.set(id, { nodeId: id, output: result })
        yield { type: 'node_completed', nodeId: id, outputPreview: preview(result) }
        continue
      }

      if (node.type === 'output') {
        finalOutput = combinedContext || opts.input
        results.set(id, { nodeId: id, output: finalOutput })
        yield { type: 'node_completed', nodeId: id, outputPreview: preview(finalOutput) }
        continue
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      yield { type: 'node_failed', nodeId: id, message }
      yield { type: 'error', message: `Node "${node.data.label}" failed: ${message}` }
      return
    }
  }

  if (!finalOutput) {
    const lastAgent = Array.from(results.values()).reverse().find((r) => !!r.output)
    finalOutput = lastAgent?.output ?? ''
  }

  yield { type: 'final', output: finalOutput }
}

async function runAgentNode(args: {
  node: TeamNode
  apiKey: string
  inputs: string
  signal?: AbortSignal
  onEvent: (ev: ExecutorEvent) => void
}): Promise<string> {
  const data = args.node.data as AgentNodeData
  const tools = buildToolsForAgent(data.toolNames).map((t) => t.tool)

  const llm = new ChatOpenAI({
    model: data.model,
    temperature: data.temperature,
    apiKey: args.apiKey,
  })

  const agent = createAgent({
    model: llm,
    tools,
    systemPrompt: data.systemPrompt,
  })

  const result = await agent.invoke(
    { messages: [new SystemMessage(data.systemPrompt), new HumanMessage(args.inputs)] },
    { recursionLimit: Math.max(2, data.maxTurns * 2), signal: args.signal }
  )

  const messages = (result.messages ?? []) as Array<{ content: unknown; _getType?: () => string }>
  const lastAi = [...messages].reverse().find((m) => m._getType?.() === 'ai')
  const content = lastAi?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((c: unknown) => {
        if (typeof c === 'string') return c
        if (c && typeof c === 'object' && 'text' in c) return String((c as { text: string }).text)
        return ''
      })
      .join('')
  }
  return ''
}

function preview(text: string, max = 240): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return trimmed.slice(0, max) + '…'
}
