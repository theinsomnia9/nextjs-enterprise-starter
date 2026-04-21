import { describe, it, expect } from 'vitest'
import { buildAgent, AgentConfig } from '@/lib/agent/agent'

describe('buildAgent', () => {
  it('should return a compiled LangGraph agent', () => {
    process.env.OPENAI_API_KEY = 'sk-test-key'
    process.env.TAVILY_API_KEY = 'tvly-test-key'

    const agent = buildAgent()

    expect(agent).toBeDefined()
    expect(agent.invoke).toBeInstanceOf(Function)
    expect(agent.streamEvents).toBeInstanceOf(Function)
  })

  it('should throw if TAVILY_API_KEY is missing', () => {
    process.env.OPENAI_API_KEY = 'sk-test-key'
    delete process.env.TAVILY_API_KEY

    expect(() => buildAgent()).toThrow('TAVILY_API_KEY is not configured')
  })

  it('should accept custom model configuration', () => {
    process.env.OPENAI_API_KEY = 'sk-test-key'
    process.env.TAVILY_API_KEY = 'tvly-test-key'

    const config: AgentConfig = {
      model: 'gpt-4o',
      temperature: 0.5,
    }

    const agent = buildAgent(config)
    expect(agent).toBeDefined()
  })
})
