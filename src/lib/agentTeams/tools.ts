import { tool } from 'langchain'
import { z } from 'zod'
import { evaluate } from 'mathjs'
import { tavily } from '@tavily/core'
import { getToolSpec } from './toolRegistry'

// LangChain's `tool()` is an overloaded factory whose narrow return types don't
// union cleanly; the agent runtime takes any structured tool, so we widen here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = any

export interface BuiltTool {
  name: string
  tool: AnyTool
  unavailable?: string
}

function calculatorTool(): AnyTool {
  return tool(
    async ({ expression }: { expression: string }) => {
      try {
        return String(evaluate(expression))
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'invalid expression'
        return `calculator failed: ${msg}`
      }
    },
    {
      name: 'calculator',
      description:
        'Evaluate a mathematical expression, e.g. "2 + 2 * 3" or "sqrt(16)". Returns the result as a string.',
      schema: z.object({ expression: z.string() }),
    }
  )
}

function tavilyTool(): AnyTool | null {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) {
    return null
  }
  const client = tavily({ apiKey })
  return tool(
    async ({ query }: { query: string }) => {
      try {
        const res = await client.search(query, { maxResults: 3 })
        return JSON.stringify(res.results)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown error'
        return JSON.stringify({ error: `tavily_search failed: ${msg}` })
      }
    },
    {
      name: 'tavily_search',
      description:
        'Search the public web for up-to-date information. Returns a JSON array of result snippets.',
      schema: z.object({ query: z.string() }),
    }
  )
}

function httpGetMockTool(): AnyTool {
  // PLACEHOLDER — stubbed response so the demo runs without network egress.
  // In production, wire this to fetch with an allowlist, timeout, and response-size caps.
  return tool(
    async ({ url }: { url: string }) => {
      return JSON.stringify({
        url,
        status: 200,
        body: `<!-- MOCK HTTP RESPONSE for ${url} --> This is a canned payload. Replace http_get with a real fetch gated by an allowlist before prod.`,
      })
    },
    {
      name: 'http_get',
      description: 'PLACEHOLDER mock HTTP GET. Returns a canned response string for the given URL.',
      schema: z.object({ url: z.string().url() }),
    }
  )
}

function kbLookupMockTool(): AnyTool {
  // PLACEHOLDER — canned KB snippets for demo; swap in real RAG before prod.
  const FAUX_KB: Record<string, string> = {
    refund:
      'Refund policy: full refunds within 30 days of purchase; partial refunds 31-60 days at manager discretion.',
    sla: 'Default SLA: P1 = 24h, P2 = 48h, P3 = 72h, P4 = 120h.',
    onboarding:
      'Onboarding checklist: (1) create entra account, (2) assign role, (3) send welcome email, (4) schedule training.',
  }
  return tool(
    async ({ query }: { query: string }) => {
      const key = Object.keys(FAUX_KB).find((k) => query.toLowerCase().includes(k))
      if (!key) return JSON.stringify({ hits: [] })
      return JSON.stringify({ hits: [{ key, snippet: FAUX_KB[key] }] })
    },
    {
      name: 'kb_lookup',
      description: 'PLACEHOLDER mock knowledge base lookup. Returns canned snippets for known keys.',
      schema: z.object({ query: z.string() }),
    }
  )
}

export function buildToolsForAgent(toolNames: string[]): BuiltTool[] {
  const built: BuiltTool[] = []
  for (const name of toolNames) {
    const spec = getToolSpec(name)
    if (!spec) continue
    switch (name) {
      case 'calculator':
        built.push({ name, tool: calculatorTool() })
        break
      case 'tavily_search': {
        const t = tavilyTool()
        if (t) built.push({ name, tool: t })
        else built.push({ name, tool: calculatorTool(), unavailable: 'TAVILY_API_KEY missing' })
        break
      }
      case 'http_get':
        built.push({ name, tool: httpGetMockTool() })
        break
      case 'kb_lookup':
        built.push({ name, tool: kbLookupMockTool() })
        break
    }
  }
  return built
}
