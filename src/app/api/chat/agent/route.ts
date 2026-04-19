import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSpan } from '@/lib/telemetry/tracing'
import { getAgent } from '@/lib/agent/agent'
import { resolveChat, saveAssistantMessage } from '@/lib/chat/helpers'
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'
import { SSE_HEADERS } from '@/lib/sse/eventTypes'

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

export async function POST(req: NextRequest) {
  return await createSpan('http.chat.agent', async (span) => {
    try {
      const body = await req.json()
      const { message, chatId, threadId } = requestSchema.parse(body)

      span.setAttributes({
        'chat.message_length': message.length,
        'chat.has_existing_id': !!chatId,
        'chat.has_thread_id': !!threadId,
      })

      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500 })
      }
      if (!process.env.TAVILY_API_KEY) {
        return NextResponse.json({ error: 'TAVILY_API_KEY is not configured' }, { status: 500 })
      }

      const chat = await resolveChat(chatId, message)
      if (!chat) {
        return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
      }

      const langChainMessages = chat.previousMessages.map((msg) =>
        toAgentMessage(msg.role, msg.content)
      )

      const agent = getAgent()
      const conversationThreadId = threadId ?? chat.chatId
      const encoder = new TextEncoder()
      let fullResponse = ''

      const send = (controller: ReadableStreamDefaultController, payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            send(controller, { chatId: chat.chatId })

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
              if (event.event === 'on_chat_model_stream') {
                const content = event.data?.chunk?.content
                if (content) {
                  fullResponse += content
                  send(controller, { type: 'token', content })
                }
              }

              if (event.event === 'on_tool_start') {
                send(controller, {
                  type: 'tool_start',
                  tool: event.name,
                  input: (event.data as { input?: unknown }).input,
                })
              }

              if (event.event === 'on_tool_end') {
                const output = (event.data as { output?: unknown }).output
                send(controller, {
                  type: 'tool_end',
                  tool: event.name,
                  output: typeof output === 'string' ? output : JSON.stringify(output),
                })
              }

              if (event.event === 'on_chat_model_start') {
                send(controller, { type: 'thinking', message: 'Agent is thinking...' })
              }
            }

            await saveAssistantMessage(chat.chatId, fullResponse)

            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          } catch (error) {
            // Persist whatever we have so the chat history isn't left blank.
            if (fullResponse) {
              try {
                await saveAssistantMessage(chat.chatId, fullResponse)
              } catch (saveError) {
                console.error('Failed to persist partial assistant message:', saveError)
              }
            }

            const aborted = req.signal.aborted
            if (!aborted) {
              const message = error instanceof Error ? error.message : 'Stream failed'
              console.error('Agent stream error:', error)
              send(controller, { type: 'error', message })
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          }
        },
      })

      return new Response(readableStream, { headers: SSE_HEADERS })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
      }
      console.error('Agent chat API error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
}
