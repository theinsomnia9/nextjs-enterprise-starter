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
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
      }
      console.error('Agent chat API error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
}
