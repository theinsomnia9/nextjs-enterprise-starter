import { ChatOpenAI } from '@langchain/openai'
import { Calculator } from '@langchain/community/tools/calculator'
import { createReactAgent } from '@langchain/langgraph/prebuilt'
import { MemorySaver } from '@langchain/langgraph-checkpoint'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { tavily, type TavilyClient } from '@tavily/core'

export interface AgentConfig {
  model?: string
  temperature?: number
}

export type CompiledAgent = ReturnType<typeof createReactAgent>

const SYSTEM_PROMPT = [
  'You are a helpful assistant with access to two tools:',
  '- `tavily_search` for current events, recent facts, or anything that may have changed since training.',
  '- `calculator` for arithmetic the model should not perform mentally.',
  'Prefer answering directly when no tool is needed. Cite sources from search results when you use them.',
].join(' ')

let tavilyClient: TavilyClient | null = null

function getTavilyClient(apiKey: string): TavilyClient {
  if (!tavilyClient) {
    tavilyClient = tavily({ apiKey })
  }
  return tavilyClient
}

let agentSingleton: CompiledAgent | null = null

export function getAgent(): CompiledAgent {
  if (!agentSingleton) {
    agentSingleton = createAgent()
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

  const tavilySearch = tool(
    async ({ query }: { query: string }) => {
      const client = getTavilyClient(tavilyApiKey)
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

  const checkpointer = new MemorySaver()

  return createReactAgent({
    llm: model,
    tools,
    checkpointSaver: checkpointer,
    prompt: SYSTEM_PROMPT,
  })
}
