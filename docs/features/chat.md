# Chat

Two streaming chat modes:

- **Plain** (`/api/chat`, `src/app/api/chat/route.ts`) — OpenAI GPT-4o-mini streamed via SSE. Direct, no tools.
- **Agent** (`/api/chat/agent`, `src/app/api/chat/agent/route.ts`) — LangGraph `createAgent` with a Tavily web-search tool and a `mathjs` calculator tool. See `src/lib/agent/agent.ts`.

Both routes persist every user + assistant message to Postgres (`Chat`, `Message`, `MessageRole` enum in `prisma/schema.prisma`) and emit OTEL spans via `createSpan`.

## Routes

| Method · Path | Purpose |
|---|---|
| `POST /api/chat` | Stream a plain-LLM response; creates a chat on first turn, appends on subsequent turns |
| `POST /api/chat/agent` | Stream an agent response (tool calls emitted as named SSE events) |
| `GET  /api/chat/history` | 50 most-recent chats for the signed-in user |
| `GET  /api/chat/[chatId]/messages` | Full message list for one chat |

## UI

- Page: `src/app/chat/page.tsx`
- Components: `ChatMessage`, `ChatInput`, `ChatHistory`, `AgentActivityPanel` in `src/components/chat/`
- Streaming client decodes SSE via `fetch` + `ReadableStream`; agent mode surfaces tool-use events in `AgentActivityPanel`.

## Agent persistence

`MemorySaver` from `@langchain/langgraph` keeps per-thread state in memory and resets on server restart. For multi-replica prod, swap to `@langchain/langgraph-checkpoint-postgres`.

## Required env

```bash
OPENAI_API_KEY=sk-...
TAVILY_API_KEY=tvly-...    # agent route only
```

## Tests

- Unit: `__tests__/unit/app/api/chat/**`, `__tests__/unit/components/chat/**`
- E2E: `__tests__/e2e/chat.spec.ts` (full live call is skipped; gates + UI covered)
