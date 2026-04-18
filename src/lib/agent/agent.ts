import { ChatOpenAI } from '@langchain/openai'
import { Calculator } from '@langchain/community/tools/calculator'
import { createReactAgent } from '@langchain/langgraph/prebuilt'
import { MemorySaver } from '@langchain/langgraph-checkpoint'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { tavily } from '@tavily/core'
import type { BaseMessage } from '@langchain/core/messages'

export interface AgentConfig {
  model?: string
  temperature?: number
}

export interface CompiledAgent {
  invoke: (
    input: { messages: BaseMessage[] },
    config?: { configurable?: { thread_id?: string } }
  ) => Promise<{ messages: BaseMessage[] }>
  streamEvents: (
    input: { messages: BaseMessage[] },
    options: { version: 'v1' | 'v2'; configurable?: { thread_id?: string } }
  ) => AsyncIterable<{
    event: string
    name: string
    data: { chunk?: { content?: string }; output?: { content?: string } }
  }>
}

// Module-level singleton — MemorySaver is in-memory and resets on server restart.
// For production, swap to @langchain/langgraph-checkpoint-postgres.
let agentSingleton: CompiledAgent | null = null

export function getAgent(config: AgentConfig = {}): CompiledAgent {
  if (!agentSingleton) {
    agentSingleton = createAgent(config)
  }
  return agentSingleton
}

export function createAgent(config: AgentConfig = {}): CompiledAgent {
  const openAIApiKey = process.env.OPENAI_API_KEY
  const tavilyApiKey = process.env.TAVILY_API_KEY

  if (!openAIApiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  if (!tavilyApiKey) {
    throw new Error('TAVILY_API_KEY is not configured')
  }

  const model = new ChatOpenAI({
    model: config.model ?? 'gpt-4o-mini',
    temperature: config.temperature ?? 0.7,
    apiKey: openAIApiKey,
  })

  // Create Tavily search tool
  const tavilySearch = tool(
    async ({ query }: { query: string }) => {
      const client = tavily({ apiKey: tavilyApiKey })
      const response = await client.search(query, { maxResults: 3 })
      return JSON.stringify(response.results)
    },
    {
      name: 'tavily_search',
      description: 'Search the web for current information using Tavily',
      schema: z.object({
        query: z.string().describe('The search query'),
      }),
    }
  )

  const tools = [tavilySearch, new Calculator()]

  // In-memory checkpointer - resets on server restart
  // For production: use @langchain/langgraph-checkpoint-postgres
  const checkpointer = new MemorySaver()

  const agent = createReactAgent({
    llm: model,
    tools,
    checkpointSaver: checkpointer,
  })

  return agent as unknown as CompiledAgent
}
