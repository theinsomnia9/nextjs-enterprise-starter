import { createAgent, tool } from 'langchain'
import { MemorySaver } from '@langchain/langgraph'
import { evaluate } from 'mathjs'
import { z } from 'zod'
import { tavily } from '@tavily/core'
import { getChatModel } from '@/lib/ai'

export interface AgentConfig {
  model?: string
  temperature?: number
}

export type CompiledAgent = ReturnType<typeof createAgent>

const SYSTEM_PROMPT = [
  'You are a helpful assistant with access to two tools:',
  '- `tavily_search` for current events, recent facts, or anything that may have changed since training.',
  '- `calculator` for arithmetic the model should not perform mentally.',
  'Prefer answering directly when no tool is needed. Cite sources from search results when you use them.',
].join(' ')

let agentSingleton: CompiledAgent | null = null

export function getAgent(): CompiledAgent {
  if (!agentSingleton) {
    agentSingleton = buildAgent()
  }
  return agentSingleton
}

export function buildAgent(config: AgentConfig = {}): CompiledAgent {
  const tavilyApiKey = process.env.TAVILY_API_KEY

  if (!tavilyApiKey) {
    throw new Error('TAVILY_API_KEY is not configured')
  }

  const model = getChatModel({
    model: config.model,
    temperature: config.temperature ?? 0.7,
  })

  const tavilyClient = tavily({ apiKey: tavilyApiKey })
  const tavilySearch = tool(
    async ({ query }: { query: string }) => {
      try {
        const response = await tavilyClient.search(query, { maxResults: 3 })
        return JSON.stringify(response.results)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error'
        return JSON.stringify({ error: `tavily_search failed: ${message}` })
      }
    },
    {
      name: 'tavily_search',
      description: 'Search the web for current information using Tavily',
      schema: z.object({
        query: z.string().describe('The search query'),
      }),
    }
  )

  const calculator = tool(
    async ({ expression }: { expression: string }) => {
      try {
        return String(evaluate(expression))
      } catch (error) {
        const message = error instanceof Error ? error.message : 'invalid expression'
        return `calculator failed: ${message}`
      }
    },
    {
      name: 'calculator',
      description:
        'Evaluate a mathematical expression. Input should be a single expression such as "2 + 2 * 3" or "sqrt(16)".',
      schema: z.object({
        expression: z.string().describe('A valid math expression to evaluate'),
      }),
    }
  )

  return createAgent({
    model,
    tools: [tavilySearch, calculator],
    checkpointer: new MemorySaver(),
    systemPrompt: SYSTEM_PROMPT,
  })
}
