// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import OpenAI, { AzureOpenAI } from 'openai'
import { ChatOpenAI, AzureChatOpenAI } from '@langchain/openai'
import {
  getChatClient,
  getChatModel,
  chatModelName,
  __resetForTests,
} from '@/lib/ai/provider'
import * as tracing from '@/lib/telemetry/tracing'

vi.mock('@/lib/telemetry/tracing', () => ({
  addSpanAttribute: vi.fn(),
}))

const originalEnv = { ...process.env }

function setOpenaiEnv() {
  process.env.LLM_PROVIDER = 'openai'
  process.env.OPENAI_API_KEY = 'sk-test'
  process.env.OPENAI_CHAT_MODEL = 'gpt-4o-mini'
  delete process.env.OPENAI_BASE_URL
}

function setAzureEnv() {
  process.env.LLM_PROVIDER = 'azure-openai'
  process.env.AZURE_OPENAI_API_KEY = 'az-test'
  process.env.AZURE_OPENAI_ENDPOINT = 'https://example.openai.azure.com'
  process.env.AZURE_OPENAI_API_VERSION = '2024-10-21'
  process.env.AZURE_OPENAI_CHAT_DEPLOYMENT = 'gpt4o-prod'
}

describe('ai/provider', () => {
  beforeEach(() => {
    __resetForTests()
    for (const k of Object.keys(process.env)) {
      if (k.startsWith('OPENAI_') || k.startsWith('AZURE_OPENAI_') || k === 'LLM_PROVIDER') {
        delete process.env[k]
      }
    }
  })

  afterEach(() => {
    __resetForTests()
    Object.assign(process.env, originalEnv)
  })

  describe('getChatClient', () => {
    it('returns an OpenAI client on LLM_PROVIDER=openai', () => {
      setOpenaiEnv()

      const client = getChatClient()

      expect(client).toBeInstanceOf(OpenAI)
      expect(client).not.toBeInstanceOf(AzureOpenAI)
    })

    it('returns an AzureOpenAI client on LLM_PROVIDER=azure-openai', () => {
      setAzureEnv()

      const client = getChatClient()

      expect(client).toBeInstanceOf(AzureOpenAI)
    })

    it('caches the client across calls (singleton)', () => {
      setOpenaiEnv()

      const a = getChatClient()
      const b = getChatClient()

      expect(a).toBe(b)
    })

    it('rebuilds after __resetForTests()', () => {
      setOpenaiEnv()
      const a = getChatClient()

      __resetForTests()
      const b = getChatClient()

      expect(a).not.toBe(b)
    })
  })

  describe('getChatModel', () => {
    it('returns a ChatOpenAI on OpenAI', () => {
      setOpenaiEnv()

      const model = getChatModel()

      expect(model).toBeInstanceOf(ChatOpenAI)
      expect(model).not.toBeInstanceOf(AzureChatOpenAI)
    })

    it('returns an AzureChatOpenAI on Azure', () => {
      setAzureEnv()

      const model = getChatModel()

      expect(model).toBeInstanceOf(AzureChatOpenAI)
    })

    it('forwards model override on OpenAI', () => {
      setOpenaiEnv()

      const model = getChatModel({ model: 'gpt-4o' }) as ChatOpenAI

      expect((model as unknown as { model: string }).model).toBe('gpt-4o')
    })

    it('ignores caller model on Azure in favor of the deployment env', () => {
      setAzureEnv()

      const model = getChatModel({ model: 'gpt-4o' }) as AzureChatOpenAI

      expect(model.azureOpenAIApiDeploymentName).toBe('gpt4o-prod')
    })

    it('forwards temperature on both providers', () => {
      setOpenaiEnv()
      const openai = getChatModel({ temperature: 0.25 }) as ChatOpenAI
      expect((openai as unknown as { temperature: number }).temperature).toBe(0.25)

      __resetForTests()
      setAzureEnv()
      const azure = getChatModel({ temperature: 0.75 }) as AzureChatOpenAI
      expect((azure as unknown as { temperature: number }).temperature).toBe(0.75)
    })

    it('does not cache model instances (fresh per call)', () => {
      setOpenaiEnv()

      const a = getChatModel()
      const b = getChatModel()

      expect(a).not.toBe(b)
    })
  })

  describe('chatModelName', () => {
    it('returns OPENAI_CHAT_MODEL on OpenAI', () => {
      setOpenaiEnv()

      expect(chatModelName()).toBe('gpt-4o-mini')
    })

    it('returns AZURE_OPENAI_CHAT_DEPLOYMENT on Azure', () => {
      setAzureEnv()

      expect(chatModelName()).toBe('gpt4o-prod')
    })
  })

  describe('telemetry', () => {
    it('tags the current span with ai.provider on getChatClient', () => {
      setOpenaiEnv()

      getChatClient()

      expect(tracing.addSpanAttribute).toHaveBeenCalledWith('ai.provider', 'openai')
    })

    it('tags the current span with ai.provider on getChatModel', () => {
      setAzureEnv()

      getChatModel()

      expect(tracing.addSpanAttribute).toHaveBeenCalledWith('ai.provider', 'azure-openai')
    })
  })
})
