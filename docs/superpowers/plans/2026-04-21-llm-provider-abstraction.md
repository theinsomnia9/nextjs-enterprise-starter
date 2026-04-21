# LLM Provider Abstraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a `src/lib/ai/` module that lets the app target OpenAI, OpenAI-compatible endpoints (via `baseURL`), or classic Azure OpenAI (deployment + api_version) via env, and migrate every existing caller to use it.

**Architecture:** One env-driven config (Zod discriminated union on `LLM_PROVIDER`), two factory functions (`getChatClient()` returns an `OpenAI`-shaped client, `getChatModel()` returns a LangChain `BaseChatModel`), plus a helper `chatModelName()`. All five current callers stop importing `openai` / `@langchain/openai` directly; an ESLint rule enforces that going forward.

**Tech Stack:** TypeScript, Next.js 16, Zod, `openai` ^4.x (ships `OpenAI` + `AzureOpenAI`), `@langchain/openai` ^1.x (ships `ChatOpenAI` + `AzureChatOpenAI`), Vitest.

**Spec:** `docs/superpowers/specs/2026-04-21-llm-provider-abstraction-design.md`

---

## File Structure

**Create:**
- `src/lib/ai/config.ts` — Zod schema + `getLlmConfig()` (cached parse of env)
- `src/lib/ai/provider.ts` — `getChatClient()`, `getChatModel()`, `chatModelName()`, `__resetForTests()`
- `src/lib/ai/index.ts` — barrel re-exporting the three factory functions + `LlmConfig` type
- `__tests__/unit/lib/ai/config.test.ts`
- `__tests__/unit/lib/ai/provider.test.ts`

**Modify:**
- `src/lib/agent/agent.ts` — replace direct `ChatOpenAI` use
- `src/app/api/chat/route.ts` — replace direct `OpenAI` use
- `src/app/api/chat/agent/route.ts` — remove redundant env gates
- `src/lib/agentTeams/executor.ts` — replace direct `ChatOpenAI` use; drop `apiKey` option
- `src/lib/agentTeams/designer.ts` — replace direct `ChatOpenAI` use; drop `apiKey` option
- `__tests__/unit/app/api/chat/route.test.ts` — swap `openai` mock for `@/lib/ai` mock
- `.env.example` — add provider blocks
- `eslint.config.js` — add `no-restricted-imports` rule
- `CLAUDE.md` — append short AI Provider section

---

## Task 1: Scaffold `src/lib/ai/config.ts` with Zod discriminated union

**Files:**
- Create: `src/lib/ai/config.ts`
- Test: `__tests__/unit/lib/ai/config.test.ts`

- [ ] **Step 1: Write failing tests for config parsing**

Create `__tests__/unit/lib/ai/config.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests, confirm they fail**

Run: `npx vitest run __tests__/unit/lib/ai/config.test.ts`
Expected: FAIL with "Cannot find module '@/lib/ai/config'" or similar.

- [ ] **Step 3: Implement `src/lib/ai/config.ts`**

Create `src/lib/ai/config.ts`:

```typescript
import { z } from 'zod'

const nonEmpty = (name: string) =>
  z
    .string({ required_error: `${name} is required when LLM_PROVIDER=${name.startsWith('AZURE_') ? 'azure-openai' : 'openai'}` })
    .min(1, `${name} is required when LLM_PROVIDER=${name.startsWith('AZURE_') ? 'azure-openai' : 'openai'}`)

const apiVersionRegex = /^\d{4}-\d{2}-\d{2}(-preview)?$/

const openaiSchema = z.object({
  provider: z.literal('openai'),
  apiKey: nonEmpty('OPENAI_API_KEY'),
  baseUrl: z.string().url('OPENAI_BASE_URL must be a valid URL').optional(),
  chatModel: z.string().min(1).default('gpt-4o-mini'),
})

const azureSchema = z.object({
  provider: z.literal('azure-openai'),
  apiKey: nonEmpty('AZURE_OPENAI_API_KEY'),
  endpoint: z
    .string({ required_error: 'AZURE_OPENAI_ENDPOINT is required when LLM_PROVIDER=azure-openai' })
    .min(1, 'AZURE_OPENAI_ENDPOINT is required when LLM_PROVIDER=azure-openai')
    .url('AZURE_OPENAI_ENDPOINT must be a valid URL'),
  apiVersion: z
    .string({ required_error: 'AZURE_OPENAI_API_VERSION is required when LLM_PROVIDER=azure-openai' })
    .min(1, 'AZURE_OPENAI_API_VERSION is required when LLM_PROVIDER=azure-openai')
    .regex(apiVersionRegex, 'AZURE_OPENAI_API_VERSION must look like YYYY-MM-DD or YYYY-MM-DD-preview'),
  chatDeployment: nonEmpty('AZURE_OPENAI_CHAT_DEPLOYMENT'),
})

const llmConfigSchema = z.discriminatedUnion('provider', [openaiSchema, azureSchema])

export type LlmConfig = z.infer<typeof llmConfigSchema>

function readRaw(): unknown {
  const rawProvider = process.env.LLM_PROVIDER?.trim() || 'openai'

  if (rawProvider === 'openai') {
    return {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL || undefined,
      chatModel: process.env.OPENAI_CHAT_MODEL || undefined,
    }
  }

  if (rawProvider === 'azure-openai') {
    return {
      provider: 'azure-openai',
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION,
      chatDeployment: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT,
    }
  }

  return { provider: rawProvider }
}

export function parseLlmConfig(): LlmConfig {
  const parsed = llmConfigSchema.safeParse(readRaw())
  if (!parsed.success) {
    const first = parsed.error.errors[0]
    throw new Error(first?.message ?? 'Invalid LLM configuration')
  }
  return parsed.data
}
```

- [ ] **Step 4: Run tests, confirm they pass**

Run: `npx vitest run __tests__/unit/lib/ai/config.test.ts`
Expected: PASS all cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/config.ts __tests__/unit/lib/ai/config.test.ts
git commit -m "feat(ai): add LlmConfig Zod schema with provider discrimination"
```

---

## Task 2: Implement provider factories (`getChatClient`, `getChatModel`, `chatModelName`)

**Files:**
- Create: `src/lib/ai/provider.ts`, `src/lib/ai/index.ts`
- Test: `__tests__/unit/lib/ai/provider.test.ts`

- [ ] **Step 1: Write failing tests for the factory**

Create `__tests__/unit/lib/ai/provider.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests, confirm they fail**

Run: `npx vitest run __tests__/unit/lib/ai/provider.test.ts`
Expected: FAIL with "Cannot find module '@/lib/ai/provider'".

- [ ] **Step 3: Implement `src/lib/ai/provider.ts`**

Create `src/lib/ai/provider.ts`:

```typescript
import OpenAI, { AzureOpenAI } from 'openai'
import { ChatOpenAI, AzureChatOpenAI } from '@langchain/openai'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { parseLlmConfig, type LlmConfig } from './config'
import { addSpanAttribute } from '@/lib/telemetry/tracing'

let cachedConfig: LlmConfig | null = null
let cachedClient: OpenAI | null = null

function config(): LlmConfig {
  if (!cachedConfig) {
    cachedConfig = parseLlmConfig()
  }
  return cachedConfig
}

export function getChatClient(): OpenAI {
  if (cachedClient) {
    addSpanAttribute('ai.provider', cachedConfig!.provider)
    return cachedClient
  }

  const cfg = config()
  addSpanAttribute('ai.provider', cfg.provider)

  if (cfg.provider === 'azure-openai') {
    cachedClient = new AzureOpenAI({
      apiKey: cfg.apiKey,
      endpoint: cfg.endpoint,
      apiVersion: cfg.apiVersion,
      deployment: cfg.chatDeployment,
    })
  } else {
    cachedClient = new OpenAI({
      apiKey: cfg.apiKey,
      baseURL: cfg.baseUrl,
    })
  }
  return cachedClient
}

export interface ChatModelOptions {
  model?: string
  temperature?: number
}

export function getChatModel(opts: ChatModelOptions = {}): BaseChatModel {
  const cfg = config()
  addSpanAttribute('ai.provider', cfg.provider)

  if (cfg.provider === 'azure-openai') {
    return new AzureChatOpenAI({
      azureOpenAIApiKey: cfg.apiKey,
      azureOpenAIEndpoint: cfg.endpoint,
      azureOpenAIApiVersion: cfg.apiVersion,
      azureOpenAIApiDeploymentName: cfg.chatDeployment,
      temperature: opts.temperature,
    })
  }

  return new ChatOpenAI({
    apiKey: cfg.apiKey,
    model: opts.model ?? cfg.chatModel,
    temperature: opts.temperature,
    configuration: cfg.baseUrl ? { baseURL: cfg.baseUrl } : undefined,
  })
}

export function chatModelName(): string {
  const cfg = config()
  return cfg.provider === 'azure-openai' ? cfg.chatDeployment : cfg.chatModel
}

export function __resetForTests(): void {
  cachedConfig = null
  cachedClient = null
}
```

- [ ] **Step 4: Create the barrel**

Create `src/lib/ai/index.ts`:

```typescript
export { getChatClient, getChatModel, chatModelName } from './provider'
export type { ChatModelOptions } from './provider'
export type { LlmConfig } from './config'
```

- [ ] **Step 5: Run tests, confirm they pass**

Run: `npx vitest run __tests__/unit/lib/ai/provider.test.ts`
Expected: PASS all cases.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/provider.ts src/lib/ai/index.ts __tests__/unit/lib/ai/provider.test.ts
git commit -m "feat(ai): add getChatClient/getChatModel/chatModelName factories"
```

---

## Task 3: Migrate `src/lib/agent/agent.ts`

**Files:**
- Modify: `src/lib/agent/agent.ts`

- [ ] **Step 1: Rewrite the file**

Replace `src/lib/agent/agent.ts` with:

```typescript
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
```

- [ ] **Step 2: Run existing tests to confirm no regression**

Run: `npx vitest run __tests__/unit/lib/agent 2>/dev/null || echo "no agent tests"`
Expected: PASS (or "no agent tests" — the agent has no unit tests today, only E2E coverage).

Run the broader unit suite to make sure nothing downstream broke:
Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/agent/agent.ts
git commit -m "refactor(agent): route agent LLM through src/lib/ai factory"
```

---

## Task 4: Migrate `src/app/api/chat/route.ts` and its test

**Files:**
- Modify: `src/app/api/chat/route.ts`
- Modify: `__tests__/unit/app/api/chat/route.test.ts`

- [ ] **Step 1: Update the test to mock `@/lib/ai` instead of `openai`**

In `__tests__/unit/app/api/chat/route.test.ts`, replace the `vi.mock('openai', ...)` block (lines 4-8) with:

```typescript
vi.mock('@/lib/ai', () => ({
  getChatClient: vi.fn(() => ({ chat: { completions: { create: vi.fn() } } })),
  chatModelName: vi.fn(() => 'gpt-4o-mini'),
}))
```

Then delete the entire "returns 500 when OpenAI API key is missing" test case (lines 62-79 in the pre-migration file) — the route no longer checks `OPENAI_API_KEY` directly. The config-missing path is covered by `config.test.ts`.

- [ ] **Step 2: Run the test, confirm it fails against the old route**

Run: `npx vitest run __tests__/unit/app/api/chat/route.test.ts`
Expected: FAIL — the route still imports `openai` directly, so the `@/lib/ai` mock is ignored.

- [ ] **Step 3: Rewrite the route**

Replace `src/app/api/chat/route.ts` with:

```typescript
import { z } from 'zod'
import { withApi } from '@/lib/api/withApi'
import { addSpanAttribute } from '@/lib/telemetry/tracing'
import { resolveChat, saveAssistantMessage } from '@/lib/chat/helpers'
import { SSE_HEADERS, SSE_DONE_FRAME } from '@/lib/sse/eventTypes'
import { notFound, validationError } from '@/lib/errors/AppError'
import { getChatClient, chatModelName } from '@/lib/ai'

const requestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  chatId: z.string().nullable(),
})

export const POST = withApi('http.chat.create', async (req) => {
  const body = await req.json()
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) throw validationError(parsed.error.errors[0].message)
  const { message, chatId } = parsed.data

  addSpanAttribute('chat.message_length', message.length)
  addSpanAttribute('chat.has_existing_id', !!chatId)

  const chat = await resolveChat(chatId, message)
  if (!chat) throw notFound('Chat', chatId ?? undefined)

  const messages = chat.previousMessages.map((msg) => ({
    role: msg.role.toLowerCase() as 'user' | 'assistant' | 'system',
    content: msg.content,
  }))

  const stream = await getChatClient().chat.completions.create({
    model: chatModelName(),
    messages,
    stream: true,
  })

  const encoder = new TextEncoder()
  let fullResponse = ''

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ chatId: chat.chatId })}\n\n`)
        )

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || ''
          if (content) {
            fullResponse += content
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
          }
        }

        await saveAssistantMessage(chat.chatId, fullResponse)

        controller.enqueue(encoder.encode(SSE_DONE_FRAME))
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })

  return new Response(readableStream, { headers: SSE_HEADERS })
})
```

- [ ] **Step 4: Run test, confirm it passes**

Run: `npx vitest run __tests__/unit/app/api/chat/route.test.ts`
Expected: PASS on the remaining validation cases (messages missing / empty).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/chat/route.ts __tests__/unit/app/api/chat/route.test.ts
git commit -m "refactor(chat): route streaming chat through src/lib/ai factory"
```

---

## Task 5: Simplify `src/app/api/chat/agent/route.ts`

**Files:**
- Modify: `src/app/api/chat/agent/route.ts`

- [ ] **Step 1: Delete the env gates at the top of the handler**

In `src/app/api/chat/agent/route.ts`, remove this block (currently lines 40-45):

```typescript
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured')
  }
  if (!process.env.TAVILY_API_KEY) {
    throw new Error('TAVILY_API_KEY is not configured')
  }
```

Leave everything else untouched. The LLM config check happens inside `getAgent()` via the factory, and the Tavily check happens inside `buildAgent()`.

- [ ] **Step 2: Run the unit suite**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/chat/agent/route.ts
git commit -m "refactor(chat): drop redundant env gates from agent route"
```

---

## Task 6: Migrate `src/lib/agentTeams/executor.ts`

**Files:**
- Modify: `src/lib/agentTeams/executor.ts`

- [ ] **Step 1: Rewrite the file**

Replace `src/lib/agentTeams/executor.ts` with:

```typescript
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createAgent } from 'langchain'
import type { AgentNodeData, GuardrailNodeData, TeamDefinition, TeamNode } from './types'
import { topologicalOrder, validateTeamDefinition } from './validator'
import { buildToolsForAgent } from './tools'
import { evaluateGuardrail } from './guardrails'
import { getChatModel } from '@/lib/ai'

export type ExecutorEvent =
  | { type: 'run_started'; teamId: string }
  | { type: 'node_started'; nodeId: string; label: string; kind: string }
  | { type: 'node_completed'; nodeId: string; outputPreview: string }
  | { type: 'node_skipped'; nodeId: string; reason: string }
  | { type: 'node_failed'; nodeId: string; message: string }
  | { type: 'guardrail_tripped'; nodeId: string; reason: string }
  | { type: 'tool_call'; nodeId: string; tool: string; input: unknown }
  | { type: 'token'; content: string }
  | { type: 'final'; output: string }
  | { type: 'error'; message: string }

export interface ExecutorOptions {
  teamId: string
  definition: TeamDefinition
  input: string
  signal?: AbortSignal
}

interface NodeResult {
  nodeId: string
  output: string
}

export async function* executeTeam(
  opts: ExecutorOptions
): AsyncGenerator<ExecutorEvent, void, unknown> {
  const report = validateTeamDefinition(opts.definition)
  if (!report.ok) {
    yield {
      type: 'error',
      message: `Invalid team definition: ${report.issues.map((i) => i.message).join('; ')}`,
    }
    return
  }

  yield { type: 'run_started', teamId: opts.teamId }

  const order = topologicalOrder(opts.definition)
  const byId = new Map(opts.definition.nodes.map((n) => [n.id, n]))
  const results = new Map<string, NodeResult>()

  const incomingOf = (id: string) => opts.definition.edges.filter((e) => e.target === id)

  let finalOutput = ''

  for (const id of order) {
    if (opts.signal?.aborted) {
      yield { type: 'error', message: 'aborted' }
      return
    }
    const node = byId.get(id)
    if (!node) continue

    const upstreamOutputs = incomingOf(id)
      .map((e) => results.get(e.source)?.output)
      .filter((v): v is string => typeof v === 'string' && v.length > 0)

    const combinedContext = upstreamOutputs.join('\n\n---\n\n')

    yield { type: 'node_started', nodeId: id, label: node.data.label, kind: node.type }

    try {
      if (node.type === 'trigger') {
        results.set(id, { nodeId: id, output: opts.input })
        yield {
          type: 'node_completed',
          nodeId: id,
          outputPreview: preview(opts.input),
        }
        continue
      }

      if (node.type === 'guardrail') {
        const data = node.data as GuardrailNodeData
        const toCheck = combinedContext || opts.input
        const result = evaluateGuardrail(toCheck, data)
        if (!result.ok) {
          yield { type: 'guardrail_tripped', nodeId: id, reason: result.reason ?? 'blocked' }
          yield { type: 'error', message: `Guardrail "${data.label}" blocked the run.` }
          return
        }
        results.set(id, { nodeId: id, output: toCheck })
        yield { type: 'node_completed', nodeId: id, outputPreview: 'passed' }
        continue
      }

      if (node.type === 'tool') {
        results.set(id, { nodeId: id, output: combinedContext })
        yield { type: 'node_skipped', nodeId: id, reason: 'Tools are invoked by agent nodes.' }
        continue
      }

      if (node.type === 'agent') {
        const result = await runAgentNode({
          node,
          inputs: combinedContext || opts.input,
          signal: opts.signal,
        })
        results.set(id, { nodeId: id, output: result })
        yield { type: 'node_completed', nodeId: id, outputPreview: preview(result) }
        continue
      }

      if (node.type === 'output') {
        finalOutput = combinedContext || opts.input
        results.set(id, { nodeId: id, output: finalOutput })
        yield { type: 'node_completed', nodeId: id, outputPreview: preview(finalOutput) }
        continue
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      yield { type: 'node_failed', nodeId: id, message }
      yield { type: 'error', message: `Node "${node.data.label}" failed: ${message}` }
      return
    }
  }

  if (!finalOutput) {
    const lastAgent = Array.from(results.values()).reverse().find((r) => !!r.output)
    finalOutput = lastAgent?.output ?? ''
  }

  yield { type: 'final', output: finalOutput }
}

async function runAgentNode(args: {
  node: TeamNode
  inputs: string
  signal?: AbortSignal
}): Promise<string> {
  const data = args.node.data as AgentNodeData
  const tools = buildToolsForAgent(data.toolNames).map((t) => t.tool)

  const llm = getChatModel({
    model: data.model,
    temperature: data.temperature,
  })

  const agent = createAgent({
    model: llm,
    tools,
    systemPrompt: data.systemPrompt,
  })

  const result = await agent.invoke(
    { messages: [new SystemMessage(data.systemPrompt), new HumanMessage(args.inputs)] },
    { recursionLimit: Math.max(2, data.maxTurns * 2), signal: args.signal }
  )

  const messages = (result.messages ?? []) as Array<{ content: unknown; _getType?: () => string }>
  const lastAi = [...messages].reverse().find((m) => m._getType?.() === 'ai')
  const content = lastAi?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((c: unknown) => {
        if (typeof c === 'string') return c
        if (c && typeof c === 'object' && 'text' in c) return String((c as { text: string }).text)
        return ''
      })
      .join('')
  }
  return ''
}

function preview(text: string, max = 240): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return trimmed.slice(0, max) + '…'
}
```

- [ ] **Step 2: Search for any caller passing `apiKey` into `ExecutorOptions`**

Run: `grep -rn "executeTeam(" src/ __tests__/`
Expected: no caller passes an `apiKey` field. If any does, remove it from that call site.

- [ ] **Step 3: Run the unit suite**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/agentTeams/executor.ts
git commit -m "refactor(agent-teams): route executor LLM through src/lib/ai factory"
```

---

## Task 7: Migrate `src/lib/agentTeams/designer.ts`

**Files:**
- Modify: `src/lib/agentTeams/designer.ts`

- [ ] **Step 1: Rewrite the relevant imports and `runDesigner`**

In `src/lib/agentTeams/designer.ts`:

1. Remove the import `import { ChatOpenAI } from '@langchain/openai'`.
2. Add `import { getChatModel } from '@/lib/ai'`.
3. Change `DesignerDeps`:

```typescript
export interface DesignerDeps {
  model?: string
}
```

4. Replace the current `runDesigner` body (from `const apiKey = ...` through the `new ChatOpenAI(...).withStructuredOutput(...)` call) with:

```typescript
export async function runDesigner(
  input: {
    message: string
    current: TeamDefinition
    history?: DesignerHistory[]
  },
  deps: DesignerDeps = {}
): Promise<{ diff: GraphDiff; reply: string }> {
  const llm = getChatModel({
    model: deps.model,
    temperature: 0,
  }).withStructuredOutput(diffSchema, { name: 'propose_graph_diff' })

  const messages = [
    new SystemMessage(buildSystemPrompt(input.current)),
    ...(input.history ?? []).map((m) =>
      m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
    ),
    new HumanMessage(input.message),
  ]

  const parsed = await llm.invoke(messages)
  const cleaned = stripNulls(parsed)
  const diff: GraphDiff = {
    ops: cleaned.ops as GraphDiff['ops'],
    rationale: cleaned.rationale,
  }
  return { diff, reply: cleaned.rationale }
}
```

- [ ] **Step 2: Search for any caller passing `apiKey` into `runDesigner`**

Run: `grep -rn "runDesigner(" src/ __tests__/`
Expected: no caller passes `{ apiKey }`. If any does, drop that key.

- [ ] **Step 3: Run the unit suite**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/agentTeams/designer.ts
git commit -m "refactor(agent-teams): route designer LLM through src/lib/ai factory"
```

---

## Task 8: Add ESLint guard forbidding direct SDK imports outside `src/lib/ai/**`

**Files:**
- Modify: `eslint.config.js`

- [ ] **Step 1: Add the restricted-imports rule**

In `eslint.config.js`, inside the second config object (the one with `files: ['**/*.{js,jsx,ts,tsx}']`), add a new block appended to the `module.exports` array:

```javascript
  {
    files: ['src/**/*.{ts,tsx}', '__tests__/**/*.{ts,tsx}'],
    ignores: ['src/lib/ai/**', '__tests__/unit/lib/ai/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'openai',
              message:
                'Import from "@/lib/ai" instead. Only src/lib/ai/** may import the openai SDK directly.',
            },
            {
              name: '@langchain/openai',
              message:
                'Import from "@/lib/ai" instead. Only src/lib/ai/** may import @langchain/openai directly.',
            },
          ],
        },
      ],
    },
  },
```

The `ignores` allow:
- `src/lib/ai/**` — the one module that legitimately imports the SDKs
- `__tests__/unit/lib/ai/**` — where the provider tests use `instanceof OpenAI` / `instanceof ChatOpenAI`

- [ ] **Step 2: Run lint to confirm the rule is effective**

Run: `npm run lint`
Expected: PASS (no violations — all five call sites were migrated in Tasks 3-7).

- [ ] **Step 3: Prove the rule triggers (sanity check)**

Temporarily add `import OpenAI from 'openai'` to the top of `src/app/api/chat/route.ts`.
Run: `npm run lint`
Expected: FAIL with the "Import from '@/lib/ai' instead" message pointing at that line.

Revert the change.

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add eslint.config.js
git commit -m "chore(lint): forbid direct openai/langchain imports outside src/lib/ai"
```

---

## Task 9: Update `.env.example` and `CLAUDE.md`

**Files:**
- Modify: `.env.example`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Replace the OpenAI line in `.env.example`**

In `.env.example`, replace the line `OPENAI_API_KEY="key-here-sh"` with:

```bash
# LLM provider — pick one: "openai" (OpenAI or any OpenAI-compatible endpoint) or "azure-openai"
LLM_PROVIDER="openai"

# --- when LLM_PROVIDER=openai ---
OPENAI_API_KEY="sk-..."
# Optional: point at any OpenAI-compatible endpoint (Azure AI Foundry serverless, APIM proxy, Ollama, etc.)
OPENAI_BASE_URL=""
OPENAI_CHAT_MODEL="gpt-4o-mini"

# --- when LLM_PROVIDER=azure-openai (classic Azure OpenAI, deployment + api_version) ---
AZURE_OPENAI_API_KEY=""
AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
AZURE_OPENAI_API_VERSION="2024-10-21"
AZURE_OPENAI_CHAT_DEPLOYMENT="your-deployment-name"
```

- [ ] **Step 2: Append the AI Provider section to `CLAUDE.md`**

Append to the end of `CLAUDE.md`:

```markdown
### AI Provider

LLM calls route through `src/lib/ai/`. Two provider kinds, switched via `LLM_PROVIDER`:

- `openai` — uses the `openai` SDK and `@langchain/openai`'s `ChatOpenAI`. Takes `OPENAI_API_KEY`, optional `OPENAI_BASE_URL` (for OpenAI-compatible endpoints — Azure AI Foundry serverless, APIM proxies, Ollama), and `OPENAI_CHAT_MODEL`.
- `azure-openai` — classic Azure OpenAI. Uses `AzureOpenAI` and `AzureChatOpenAI`. Takes `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_VERSION`, `AZURE_OPENAI_CHAT_DEPLOYMENT`.

Callers use `getChatClient()` (raw OpenAI-shaped client), `getChatModel({model, temperature})` (LangChain chat model), or `chatModelName()` (the string to pass as `model` on raw SDK calls). On Azure, `getChatModel`'s `model` override is ignored — the deployment env wins. For agent-team nodes where the UI lets a user pick a model per node, that string is interpreted as a deployment name under the `azure-openai` provider. An ESLint rule forbids importing `openai` or `@langchain/openai` outside `src/lib/ai/**`.
```

- [ ] **Step 3: Commit**

```bash
git add .env.example CLAUDE.md
git commit -m "docs(ai): document LLM provider abstraction in env + CLAUDE.md"
```

---

## Task 10: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full unit suite**

Run: `npm run test:unit`
Expected: PASS, coverage thresholds met.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Smoke test — OpenAI path**

With `LLM_PROVIDER=openai` and a valid `OPENAI_API_KEY` in `.env`:

Run: `npm run dev` in one terminal.
In another: `curl -X POST http://localhost:3000/api/chat -H 'Content-Type: application/json' -d '{"message":"hello","chatId":null}'`
Expected: SSE stream with `data: {...}` frames, ending with `data: [DONE]`.

(If auth blocks the route because you're not signed in, skip this step — the factory wiring is already exercised by the unit tests.)

- [ ] **Step 5: Smoke test — Azure path (optional, only if you have an Azure deployment)**

Set `LLM_PROVIDER=azure-openai` plus the four Azure vars in `.env`, restart the dev server, repeat the curl above.
Expected: same SSE shape, different upstream. Check the dev server logs for `ai.provider=azure-openai` on the span.

- [ ] **Step 6: Final commit if any lint/format drift**

If `npm run format` or `npm run lint --fix` changed anything:

```bash
git add -A
git commit -m "chore: format after ai provider refactor"
```
