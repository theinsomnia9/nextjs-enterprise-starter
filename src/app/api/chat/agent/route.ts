import { z } from 'zod'
import { withApi } from '@/lib/api/withApi'
import { addSpanAttribute } from '@/lib/telemetry/tracing'
import { getAgent } from '@/lib/agent/agent'
import { resolveChat, saveAssistantMessage } from '@/lib/chat/helpers'
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'
import { SSE_HEADERS, SSE_DONE_FRAME, AGENT_STREAM_EVENTS } from '@/lib/sse/eventTypes'
import { notFound, validationError } from '@/lib/errors/AppError'

const requestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  chatId: z.string().nullable(),
  threadId: z.string().optional(),
})


function toAgentMessage(role: string, content: string) {
  switch (role) {
    case 'USER':
      return new HumanMessage(content)
    case 'ASSISTANT':
      return new AIMessage(content)
    case 'SYSTEM':
      return new SystemMessage(content)
    default:
      return new HumanMessage(content)
  }
}

export const POST = withApi('http.chat.agent', async (req) => {
  const body = await req.json()
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) throw validationError(parsed.error.issues[0].message)
  const { message, chatId, threadId } = parsed.data

  addSpanAttribute('chat.message_length', message.length)
  addSpanAttribute('chat.has_existing_id', !!chatId)
  addSpanAttribute('chat.has_thread_id', !!threadId)

  const chat = await resolveChat(chatId, message)
  if (!chat) throw notFound('Chat', chatId ?? undefined)

  const langChainMessages = chat.previousMessages.map((msg) =>
    toAgentMessage(msg.role, msg.content)
  )

  const agent = getAgent()
  const conversationThreadId = threadId ?? chat.chatId
  const encoder = new TextEncoder()
  let fullResponse = ''

  const readableStream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }
      const finalize = () => {
        controller.enqueue(encoder.encode(SSE_DONE_FRAME))
        controller.close()
      }

      try {
        send({ chatId: chat.chatId })

        const eventStream = agent.streamEvents(
          { messages: langChainMessages },
          {
            version: 'v2',
            configurable: { thread_id: conversationThreadId },
            signal: req.signal,
            recursionLimit: 10,
          }
        )

        for await (const event of eventStream) {
          if (event.event === 'on_chat_model_start') {
            send({ type: AGENT_STREAM_EVENTS.THINKING, message: 'Agent is thinking...' })
          } else if (event.event === 'on_chat_model_stream') {
            const content = event.data?.chunk?.content
            if (content) {
              fullResponse += content
              send({ type: AGENT_STREAM_EVENTS.TOKEN, content })
            }
          } else if (event.event === 'on_tool_start') {
            send({
              type: AGENT_STREAM_EVENTS.TOOL_START,
              tool: event.name,
              input: event.data?.input,
            })
          } else if (event.event === 'on_tool_end') {
            const output = event.data?.output
            send({
              type: AGENT_STREAM_EVENTS.TOOL_END,
              tool: event.name,
              output: typeof output === 'string' ? output : JSON.stringify(output),
            })
          }
        }

        await saveAssistantMessage(chat.chatId, fullResponse)
      } catch (error) {
        if (fullResponse) {
          try {
            await saveAssistantMessage(chat.chatId, fullResponse)
          } catch (saveError) {
            console.error('Failed to persist partial assistant message:', saveError)
          }
        }

        if (!req.signal.aborted) {
          const message = error instanceof Error ? error.message : 'Stream failed'
          console.error('Agent stream error:', error)
          send({ type: AGENT_STREAM_EVENTS.ERROR, message })
        }
      } finally {
        finalize()
      }
    },
  })

  return new Response(readableStream, { headers: SSE_HEADERS })
})
