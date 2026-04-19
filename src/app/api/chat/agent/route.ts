import { z } from 'zod'
import { withApi } from '@/lib/api/withApi'
import { addSpanAttribute } from '@/lib/telemetry/tracing'
import { getAgent } from '@/lib/agent/agent'
import { resolveChat, saveAssistantMessage } from '@/lib/chat/helpers'
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'
import { notFound, validationError } from '@/lib/errors/AppError'

const requestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  chatId: z.string().nullable(),
  threadId: z.string().optional(),
})

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
} as const

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
  if (!parsed.success) throw validationError(parsed.error.errors[0].message)
  const { message, chatId, threadId } = parsed.data

  addSpanAttribute('chat.message_length', message.length)
  addSpanAttribute('chat.has_existing_id', !!chatId)
  addSpanAttribute('chat.has_thread_id', !!threadId)

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured')
  }
  if (!process.env.TAVILY_API_KEY) {
    throw new Error('TAVILY_API_KEY is not configured')
  }

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
      try {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ chatId: chat.chatId })}\n\n`)
        )

        const eventStream = agent.streamEvents(
          { messages: langChainMessages },
          { version: 'v2', configurable: { thread_id: conversationThreadId } }
        )

        for await (const event of eventStream) {
          if (event.event === 'on_chat_model_stream') {
            const content = event.data?.chunk?.content
            if (content) {
              fullResponse += content
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'token', content })}\n\n`)
              )
            }
          }

          if (event.event === 'on_tool_start') {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'tool_start',
                  tool: event.name,
                  input: (event.data as { input?: unknown }).input,
                })}\n\n`
              )
            )
          }

          if (event.event === 'on_tool_end') {
            const output = (event.data as { output?: unknown }).output
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'tool_end',
                  tool: event.name,
                  output: typeof output === 'string' ? output : JSON.stringify(output),
                })}\n\n`
              )
            )
          }

          if (event.event === 'on_chain_start' && event.name === 'agent') {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'thinking', message: 'Agent is thinking...' })}\n\n`
              )
            )
          }
        }

        await saveAssistantMessage(chat.chatId, fullResponse)

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })

  return new Response(readableStream, { headers: SSE_HEADERS })
})
