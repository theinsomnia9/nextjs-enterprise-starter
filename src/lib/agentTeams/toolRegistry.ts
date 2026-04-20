export interface ToolSpec {
  name: string
  label: string
  description: string
  risk: 'low' | 'medium' | 'high'
  requiresKey?: string
  placeholder?: boolean
}

export const TOOL_REGISTRY: Record<string, ToolSpec> = {
  tavily_search: {
    name: 'tavily_search',
    label: 'Web Search (Tavily)',
    description: 'Search the web for current information.',
    risk: 'low',
    requiresKey: 'TAVILY_API_KEY',
  },
  calculator: {
    name: 'calculator',
    label: 'Calculator',
    description: 'Evaluate a math expression via mathjs.',
    risk: 'low',
  },
  http_get: {
    name: 'http_get',
    label: 'HTTP GET (mock)',
    description:
      'PLACEHOLDER. Stubbed read-only HTTP GET that returns a canned response. Wire to real fetch with allowlist before prod.',
    risk: 'medium',
    placeholder: true,
  },
  kb_lookup: {
    name: 'kb_lookup',
    label: 'Knowledge Base Lookup (mock)',
    description:
      'PLACEHOLDER. Returns canned snippets from a faux knowledge base. Replace with a real RAG pipeline.',
    risk: 'low',
    placeholder: true,
  },
}

export function getToolSpec(name: string): ToolSpec | null {
  return TOOL_REGISTRY[name] ?? null
}

export function listTools(): ToolSpec[] {
  return Object.values(TOOL_REGISTRY)
}
