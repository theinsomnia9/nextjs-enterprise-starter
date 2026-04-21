# LLM Provider Abstraction (OpenAI / Azure OpenAI)

**Date:** 2026-04-21
**Status:** Approved (ready for implementation plan)

## Motivation

The boilerplate hard-codes OpenAI as its LLM provider in five places — the
LangChain agent, the raw chat-streaming route, the agent-teams executor, and the
agent-teams designer, plus the agent route's env gate. Real deployments need to
target **classic Azure OpenAI** (deployment names, `api-version`, resource
endpoint) and **OpenAI-compatible endpoints** (Azure AI Foundry serverless,
APIM gateways, local inference servers — any endpoint the bare OpenAI SDK can
hit with just `apiKey` + `baseURL`).

Both the `openai` npm package and `@langchain/openai` ship Azure-aware client
classes out of the box, so the abstraction can stay thin: one module that reads
env, validates it, and hands back a ready-to-use client. The goal is that every
current caller stops caring which provider is behind the scenes.

## Non-goals

- **Embeddings, image, audio.** Chat completions (streaming, tool-calling,
  structured output) only. Not because the abstraction couldn't grow later, but
  because no caller uses embeddings in this repo today and YAGNI applies.
- **Per-feature provider selection.** The whole app uses one provider at a
  time, resolved from env. Mixing (agent on Azure, designer on OpenAI) is out
  of scope — it doubles the config surface for a use case nobody has asked for.
- **Cross-provider fallback / retry.** If the configured provider is down, the
  request fails. Failover is an operator policy decision, not a library
  concern.
- **Managed Identity / Entra-based auth for the LLM call itself.** API key
  only. The user's production Python setup uses `api_key=...` for both patterns,
  so this matches real usage. MSI can be added later without reshaping the
  interface.
- **Non-OpenAI-shaped providers** (Anthropic, Bedrock direct, Gemini). Out of
  scope. Anything OpenAI-compatible works via `OPENAI_BASE_URL`.

## Architecture

A new `src/lib/ai/` module becomes the single place that knows how to talk to
an LLM provider. Every current call site stops reading `OPENAI_API_KEY`
directly and instead pulls a ready-to-use client from this module.

```
src/lib/ai/
  config.ts        # parse + validate env once, export typed LlmConfig
  provider.ts      # factories: getChatClient(), getChatModel(), chatModelName()
  index.ts         # barrel
```

Two factory entry points cover both call styles in the repo:

- **`getChatClient()`** — returns an `OpenAI`-shaped client from the `openai`
  package. On OpenAI → `new OpenAI({ apiKey, baseURL? })`. On Azure → `new
  AzureOpenAI({ apiKey, endpoint, apiVersion, deployment })`. Both expose the
  same `chat.completions.create(...)` surface, so callers in
  `src/app/api/chat/route.ts` are unchanged except for where the client comes
  from.
- **`getChatModel(opts?)`** — returns a LangChain `BaseChatModel`. On OpenAI →
  `new ChatOpenAI({ apiKey, model, temperature, configuration: { baseURL? } })`.
  On Azure → `new AzureChatOpenAI({ azureOpenAIApiKey,
  azureOpenAIApiInstanceName, azureOpenAIApiVersion,
  azureOpenAIApiDeploymentName, temperature })`. Accepts optional overrides
  `{ model?, temperature? }` with model-vs-deployment semantics described
  below.
- **`chatModelName()`** — small helper returning the string that should be sent
  as `model` on raw OpenAI SDK calls (`getChatClient`). Returns the OpenAI
  model name on OpenAI, the deployment name on Azure. Used by
  `src/app/api/chat/route.ts` so the caller stops hard-coding `'gpt-4o-mini'`.

The factories are lazily singleton per process. Provider kind is resolved once
from env at first call and cached. A `__resetForTests()` export lets Vitest
clear the cache between tests.

**Key invariant — import discipline.** No call site outside `src/lib/ai/`
imports from `openai` or `@langchain/openai` directly. Enforced by an ESLint
`no-restricted-imports` rule so a future change can't regress back to
SDK-direct usage. The rule's allowlist is exactly `src/lib/ai/**`.

## Config surface (env vars)

One discriminator, two provider-specific blocks. No auto-detect.

```bash
# Required — which provider to use
LLM_PROVIDER=openai            # or: azure-openai

# --- when LLM_PROVIDER=openai ---
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=               # optional; set for Foundry/proxy/Ollama/etc.
OPENAI_CHAT_MODEL=gpt-4o-mini  # default model name

# --- when LLM_PROVIDER=azure-openai ---
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://{resource}.openai.azure.com
AZURE_OPENAI_API_VERSION=2024-10-21
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o-mini-deploy   # your deployment name
```

### Validation rules

- `config.ts` uses Zod, discriminated union on `LLM_PROVIDER`. Parse runs once
  on first factory call and the result is cached.
- Missing or blank required field for the selected provider throws a plain
  `Error` naming the exact var (e.g. `AZURE_OPENAI_ENDPOINT is required when
  LLM_PROVIDER=azure-openai`).
- Extra vars for the non-selected provider are **ignored, not rejected**. So
  an operator can keep both blocks populated and flip `LLM_PROVIDER` without
  editing two files.
- `LLM_PROVIDER` missing defaults to `openai` — keeps existing deployments
  working with no change to `.env`.
- `AZURE_OPENAI_ENDPOINT` must be parseable as a URL; `AZURE_OPENAI_API_VERSION`
  must look like a date (`YYYY-MM-DD` optionally with `-preview`). These are
  cheap sanity checks, not deep validation.

### Model vs. deployment

OpenAI identifies models by name (`gpt-4o-mini`). Classic Azure identifies them
by **deployment name**, which is operator-chosen. To keep caller code portable:

- `getChatModel({ model: 'gpt-4o-mini' })` — on OpenAI the `model` is passed
  through; on Azure the caller's `model` is **ignored** and
  `AZURE_OPENAI_CHAT_DEPLOYMENT` is used. This is the only sensible behavior
  because the factory cannot know what deployment name the operator created.
- `chatModelName()` returns `OPENAI_CHAT_MODEL` on OpenAI,
  `AZURE_OPENAI_CHAT_DEPLOYMENT` on Azure.
- In `src/lib/agentTeams/executor.ts` the model is user-selected per node in
  the UI. On Azure the per-node model string is interpreted as a deployment
  name. This is documented in the agent-teams README; no UI change.

### `.env.example`

Both blocks added, commented, with `LLM_PROVIDER=openai` as the shown default.
The retired global `OPENAI_API_KEY` line is replaced by the provider-specific
blocks.

## Call-site changes

Five files change. Each gets smaller.

### `src/lib/agent/agent.ts`
- Drop `import { ChatOpenAI } from '@langchain/openai'` and the
  `OPENAI_API_KEY` env check.
- Replace the `new ChatOpenAI({...})` block with
  `getChatModel({ temperature: config.temperature ?? 0.7 })`.
- The `AgentConfig.model` field is kept and forwarded, preserving current
  behavior under OpenAI and being overridden by the deployment name under
  Azure (see model-vs-deployment above).
- `TAVILY_API_KEY` check stays — it's a tool concern, not a provider concern.

### `src/app/api/chat/route.ts`
- Drop `import OpenAI from 'openai'`, the module-level `openaiClient` cache,
  `getOpenAIClient()`, and the `OPENAI_API_KEY` env check.
- `const stream = await getChatClient().chat.completions.create({ model:
  chatModelName(), messages, stream: true })`.

### `src/app/api/chat/agent/route.ts`
- Drop the `OPENAI_API_KEY` and `TAVILY_API_KEY` env checks at the top of the
  handler. The agent factory validates LLM config on first build; the Tavily
  check lives next to the tool in `agent.ts`.
- No other changes.

### `src/lib/agentTeams/executor.ts`
- Remove the `apiKey` parameter from `ExecutorOptions` and the top-of-function
  `OPENAI_API_KEY` check.
- `runAgentNode` stops instantiating `ChatOpenAI` directly; it calls
  `getChatModel({ model: data.model, temperature: data.temperature })`.

### `src/lib/agentTeams/designer.ts`
- Drop the `apiKey` field from `DesignerDeps` and the `OPENAI_API_KEY` check.
- Replace `new ChatOpenAI({...}).withStructuredOutput(...)` with
  `getChatModel({ model: deps.model, temperature: 0 }).withStructuredOutput(...)`.
  `withStructuredOutput` is a `BaseChatModel` method and works identically on
  `ChatOpenAI` and `AzureChatOpenAI`, provided the target model/deployment
  supports tool use (GPT-4o family, GPT-4 Turbo, etc.).

## Error handling

- **Config errors (missing/invalid env)** — plain `Error` with a specific
  message naming the offending var. Surfaces through `withApi` →
  `handleApiError` as a 500. Correct behavior: misconfigured env is an
  operator problem, and the error text lands in logs and traces.
- **No retries, no cross-provider fallback.** If the configured provider is
  down, requests fail.
- **Request-time errors** (rate limit, timeout, model-not-found, tool-call
  unsupported) bubble up from the underlying SDK unchanged. Both `openai` and
  `@langchain/openai` raise comparable error shapes on both provider kinds, so
  existing route-level catch blocks keep working.
- **Telemetry** — add one attribute on each factory call:
  `ai.provider = 'openai' | 'azure-openai'`. That's enough to disambiguate
  traces across environments. No new span infrastructure.

## Testing

New unit tests in `__tests__/unit/lib/ai/`:

- **`config.test.ts`**
  - valid OpenAI env parses
  - valid Azure env parses
  - missing `OPENAI_API_KEY` when `LLM_PROVIDER=openai` throws with the var
    name in the message
  - each of the four Azure-required vars, missing, throws with its name
  - `LLM_PROVIDER` missing defaults to `openai`
  - Azure vars present but `LLM_PROVIDER=openai` → valid (Azure vars ignored)
  - `AZURE_OPENAI_ENDPOINT` not a URL → throws
  - `AZURE_OPENAI_API_VERSION` not date-shaped → throws

- **`provider.test.ts`**
  - `getChatClient()` returns `OpenAI` instance on OpenAI
  - `getChatClient()` returns `AzureOpenAI` instance on Azure
  - `getChatModel()` returns `ChatOpenAI` on OpenAI
  - `getChatModel()` returns `AzureChatOpenAI` on Azure
  - `getChatModel({ model })` forwards `model` on OpenAI, ignores it on Azure
    (Azure instance uses `AZURE_OPENAI_CHAT_DEPLOYMENT`)
  - `chatModelName()` returns `OPENAI_CHAT_MODEL` on OpenAI,
    `AZURE_OPENAI_CHAT_DEPLOYMENT` on Azure
  - singleton caches first call; `__resetForTests()` clears it

Existing call-site tests: update to stub `getChatClient` / `getChatModel` from
`@/lib/ai` instead of stubbing `new OpenAI(...)` / `new ChatOpenAI(...)`.
One-line changes per test.

**ESLint guard:** add `no-restricted-imports` rule forbidding `openai` and
`@langchain/openai` outside `src/lib/ai/**`. Lint failure on CI is the
enforcement — no dedicated test.

**Coverage:** the existing 80% threshold covers the new module with the tests
above. No threshold change.

## Docs

- Short "AI Provider" section appended to `CLAUDE.md` (~10 lines): the two
  provider shapes, the env blocks, and the "no direct SDK imports outside
  `src/lib/ai/`" rule.
- `.env.example` updated as described in Config surface.
- `src/lib/agentTeams/` README (or inline doc) notes that per-node `model`
  fields become deployment names under Azure.

## Out-of-scope follow-ups (explicitly deferred)

- Embeddings factory (`getEmbeddingsClient()`) — trivial to add when a caller
  needs it; same env blocks gain `OPENAI_EMBEDDINGS_MODEL` /
  `AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT`.
- Managed Identity auth for Azure (using `DefaultAzureCredential` + token
  provider instead of API key).
- Anthropic / Bedrock / Gemini providers (would require a fatter interface
  than "OpenAI-shaped client" and should only be tackled when there's a real
  user).
- Per-feature provider selection.
