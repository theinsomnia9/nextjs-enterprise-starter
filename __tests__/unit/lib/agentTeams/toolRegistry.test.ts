import { describe, it, expect } from 'vitest'
import { TOOL_REGISTRY, getToolSpec, listTools } from '@/lib/agentTeams/toolRegistry'

describe('toolRegistry', () => {
  it('includes the known built-in tools', () => {
    expect(TOOL_REGISTRY.calculator).toBeTruthy()
    expect(TOOL_REGISTRY.tavily_search).toBeTruthy()
  })

  it('marks http_get and kb_lookup as placeholders', () => {
    expect(TOOL_REGISTRY.http_get.placeholder).toBe(true)
    expect(TOOL_REGISTRY.kb_lookup.placeholder).toBe(true)
  })

  it('returns null for unknown tool names', () => {
    expect(getToolSpec('not_a_tool')).toBeNull()
  })

  it('listTools matches TOOL_REGISTRY', () => {
    expect(listTools()).toHaveLength(Object.keys(TOOL_REGISTRY).length)
  })
})
