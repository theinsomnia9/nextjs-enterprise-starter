import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createSpan } from '@/lib/telemetry/tracing'
import { createAgent } from '@/lib/agent/agent'
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'

const requestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  chatId: z.string().nullable(),
  threadId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  return await createSpan('http.chat.agent', async (span) => {
    try {
      const body = await req.json()
      const validatedData = requestSchema.parse(body)
      const { message, chatId, threadId } = validatedData

      span.setAttributes({
        'chat.message_length': message.length,
        'chat.has_existing_id': !!chatId,
        'chat.has_thread_id': !!threadId,
      })

      // Check required environment variables
      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500 })
      }

      if (!process.env.TAVILY_API_KEY) {
        return NextResponse.json({ error: 'TAVILY_API_KEY is not configured' }, { status: 500 })
      }

      let currentChatId = chatId

      // Create new chat or verify existing one
      if (!currentChatId) {
        const newChat = await prisma.chat.create({
          data: {
            name: message.slice(0, 50),
          },
        })
        currentChatId = newChat.id
      } else {
        const existingChat = await prisma.chat.findUnique({
          where: { id: currentChatId },
        })

        if (!existingChat) {
          return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
        }
      }

      // Persist user message
      await prisma.message.create({
        data: {
          role: 'USER',
          content: message,
          chatId: currentChatId,
          userId: null,
        },
      })

      // Load previous messages for context
      const previousMessages = await prisma.message.findMany({
        where: { chatId: currentChatId },
        orderBy: { createdAt: 'asc' },
        take: 20,
      })

      // Convert DB messages to LangChain message format
      const langChainMessages = previousMessages.map((msg) => {
        const content = msg.content
        switch (msg.role) {
          case 'USER':
            return new HumanMessage(content)
          case 'ASSISTANT':
            return new AIMessage(content)
          case 'SYSTEM':
            return new SystemMessage(content)
          default:
            return new HumanMessage(content)
        }
      })

      // Create agent
      const agent = createAgent()

      // Determine thread ID for conversation memory
      const conversationThreadId = threadId ?? currentChatId

      // Stream agent response
      const encoder = new TextEncoder()
      let fullResponse = ''

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // Send chat ID first
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ chatId: currentChatId })}\n\n`)
            )

            // Stream events from the agent
            const eventStream = agent.streamEvents(
              { messages: langChainMessages },
              {
                version: 'v2',
                configurable: { thread_id: conversationThreadId },
              }
            )

            for await (const event of eventStream) {
              // Handle chat model stream events for token-by-token streaming
              if (event.event === 'on_chat_model_stream') {
                const content = event.data?.chunk?.content
                if (content) {
                  fullResponse += content
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'token', content })}\n\n`)
                  )
                }
              }

              // Handle tool start - show tool being called
              if (event.event === 'on_tool_start') {
                const toolName = event.name
                const toolInput = (event.data as any)?.input
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'tool_start',
                      tool: toolName,
                      input: toolInput,
                    })}\n\n`
                  )
                )
              }

              // Handle tool end - show tool output
              if (event.event === 'on_tool_end') {
                const toolName = event.name
                const toolOutput = (event.data as any)?.output
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'tool_end',
                      tool: toolName,
                      output:
                        typeof toolOutput === 'string' ? toolOutput : JSON.stringify(toolOutput),
                    })}\n\n`
                  )
                )
              }

              // Handle chain start for reasoning steps
              if (event.event === 'on_chain_start' && event.name === 'agent') {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'thinking', message: 'Agent is thinking...' })}\n\n`
                  )
                )
              }
            }

            // Persist assistant response
            await prisma.message.create({
              data: {
                role: 'ASSISTANT',
                content: fullResponse,
                chatId: currentChatId,
                userId: null,
              },
            })

            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          } catch (error) {
            controller.error(error)
          }
        },
      })

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
      }

      console.error('Agent chat API error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
}
