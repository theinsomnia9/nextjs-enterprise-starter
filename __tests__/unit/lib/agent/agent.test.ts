import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildAgent, AgentConfig } from '@/lib/agent/agent'

describe('buildAgent', () => {
  let originalEnv: string | undefined

  beforeEach(() => {
    originalEnv = process.env.OPENAI_API_KEY
  })

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalEnv
  })

  it('should return a compiled LangGraph agent', () => {
    process.env.OPENAI_API_KEY = 'sk-test-key'
    process.env.TAVILY_API_KEY = 'tvly-test-key'

    const agent = buildAgent()

    expect(agent).toBeDefined()
    expect(agent.invoke).toBeInstanceOf(Function)
    expect(agent.streamEvents).toBeInstanceOf(Function)
  })

  it('should throw if OPENAI_API_KEY is missing', () => {
    delete process.env.OPENAI_API_KEY
    process.env.TAVILY_API_KEY = 'tvly-test-key'

    expect(() => buildAgent()).toThrow('OPENAI_API_KEY is not configured')
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
