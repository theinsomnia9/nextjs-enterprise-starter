import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parseLlmConfig } from '@/lib/ai/config'

const originalEnv = { ...process.env }

function clearLlmEnv() {
  delete process.env.LLM_PROVIDER
  delete process.env.OPENAI_API_KEY
  delete process.env.OPENAI_BASE_URL
  delete process.env.OPENAI_CHAT_MODEL
  delete process.env.AZURE_OPENAI_API_KEY
  delete process.env.AZURE_OPENAI_ENDPOINT
  delete process.env.AZURE_OPENAI_API_VERSION
  delete process.env.AZURE_OPENAI_CHAT_DEPLOYMENT
}

describe('parseLlmConfig', () => {
  beforeEach(() => {
    clearLlmEnv()
  })

  afterEach(() => {
    clearLlmEnv()
    Object.assign(process.env, originalEnv)
  })

  it('parses a valid OpenAI config', () => {
    process.env.LLM_PROVIDER = 'openai'
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.OPENAI_CHAT_MODEL = 'gpt-4o-mini'

    const cfg = parseLlmConfig()

    expect(cfg.provider).toBe('openai')
    if (cfg.provider === 'openai') {
      expect(cfg.apiKey).toBe('sk-test')
      expect(cfg.chatModel).toBe('gpt-4o-mini')
      expect(cfg.baseUrl).toBeUndefined()
    }
  })

  it('defaults LLM_PROVIDER to openai when unset', () => {
    process.env.OPENAI_API_KEY = 'sk-test'

    const cfg = parseLlmConfig()

    expect(cfg.provider).toBe('openai')
  })

  it('applies default model gpt-4o-mini when OPENAI_CHAT_MODEL unset', () => {
    process.env.OPENAI_API_KEY = 'sk-test'

    const cfg = parseLlmConfig()
    if (cfg.provider !== 'openai') throw new Error('expected openai')

    expect(cfg.chatModel).toBe('gpt-4o-mini')
  })

  it('accepts optional OPENAI_BASE_URL for OpenAI-compatible endpoints', () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.OPENAI_BASE_URL = 'https://foundry.example.com/v1'

    const cfg = parseLlmConfig()
    if (cfg.provider !== 'openai') throw new Error('expected openai')

    expect(cfg.baseUrl).toBe('https://foundry.example.com/v1')
  })

  it('throws naming OPENAI_API_KEY when missing on openai provider', () => {
    process.env.LLM_PROVIDER = 'openai'

    expect(() => parseLlmConfig()).toThrow(/OPENAI_API_KEY/)
  })

  it('parses a valid Azure OpenAI config', () => {
    process.env.LLM_PROVIDER = 'azure-openai'
    process.env.AZURE_OPENAI_API_KEY = 'az-test'
    process.env.AZURE_OPENAI_ENDPOINT = 'https://example.openai.azure.com'
    process.env.AZURE_OPENAI_API_VERSION = '2024-10-21'
    process.env.AZURE_OPENAI_CHAT_DEPLOYMENT = 'gpt4o-prod'

    const cfg = parseLlmConfig()

    expect(cfg.provider).toBe('azure-openai')
    if (cfg.provider === 'azure-openai') {
      expect(cfg.apiKey).toBe('az-test')
      expect(cfg.endpoint).toBe('https://example.openai.azure.com')
      expect(cfg.apiVersion).toBe('2024-10-21')
      expect(cfg.chatDeployment).toBe('gpt4o-prod')
    }
  })

  it.each([
    ['AZURE_OPENAI_API_KEY', 'apiKey'],
    ['AZURE_OPENAI_ENDPOINT', 'endpoint'],
    ['AZURE_OPENAI_API_VERSION', 'apiVersion'],
    ['AZURE_OPENAI_CHAT_DEPLOYMENT', 'chatDeployment'],
  ])('throws naming %s when missing on azure-openai provider', (envVar) => {
    process.env.LLM_PROVIDER = 'azure-openai'
    process.env.AZURE_OPENAI_API_KEY = 'az-test'
    process.env.AZURE_OPENAI_ENDPOINT = 'https://example.openai.azure.com'
    process.env.AZURE_OPENAI_API_VERSION = '2024-10-21'
    process.env.AZURE_OPENAI_CHAT_DEPLOYMENT = 'gpt4o-prod'
    delete process.env[envVar]

    expect(() => parseLlmConfig()).toThrow(new RegExp(envVar))
  })

  it('ignores Azure vars when LLM_PROVIDER=openai', () => {
    process.env.LLM_PROVIDER = 'openai'
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.AZURE_OPENAI_ENDPOINT = 'totally-bogus'

    expect(() => parseLlmConfig()).not.toThrow()
  })

  it('rejects AZURE_OPENAI_ENDPOINT that is not a URL', () => {
    process.env.LLM_PROVIDER = 'azure-openai'
    process.env.AZURE_OPENAI_API_KEY = 'az-test'
    process.env.AZURE_OPENAI_ENDPOINT = 'not-a-url'
    process.env.AZURE_OPENAI_API_VERSION = '2024-10-21'
    process.env.AZURE_OPENAI_CHAT_DEPLOYMENT = 'gpt4o-prod'

    expect(() => parseLlmConfig()).toThrow(/AZURE_OPENAI_ENDPOINT/)
  })

  it('rejects AZURE_OPENAI_API_VERSION not date-shaped', () => {
    process.env.LLM_PROVIDER = 'azure-openai'
    process.env.AZURE_OPENAI_API_KEY = 'az-test'
    process.env.AZURE_OPENAI_ENDPOINT = 'https://example.openai.azure.com'
    process.env.AZURE_OPENAI_API_VERSION = 'v1'
    process.env.AZURE_OPENAI_CHAT_DEPLOYMENT = 'gpt4o-prod'

    expect(() => parseLlmConfig()).toThrow(/AZURE_OPENAI_API_VERSION/)
  })

  it('accepts preview api versions like 2024-10-21-preview', () => {
    process.env.LLM_PROVIDER = 'azure-openai'
    process.env.AZURE_OPENAI_API_KEY = 'az-test'
    process.env.AZURE_OPENAI_ENDPOINT = 'https://example.openai.azure.com'
    process.env.AZURE_OPENAI_API_VERSION = '2024-10-21-preview'
    process.env.AZURE_OPENAI_CHAT_DEPLOYMENT = 'gpt4o-prod'

    expect(() => parseLlmConfig()).not.toThrow()
  })

  it('rejects LLM_PROVIDER set to an unknown value', () => {
    process.env.LLM_PROVIDER = 'anthropic'
    process.env.OPENAI_API_KEY = 'sk-test'

    expect(() => parseLlmConfig()).toThrow(/LLM_PROVIDER/)
  })
})
