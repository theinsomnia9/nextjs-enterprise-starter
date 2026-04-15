import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createSpan } from '@/lib/telemetry/tracing'

const requestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  chatId: z.string().nullable(),
})

export async function POST(req: NextRequest) {
  return await createSpan('http.chat.create', async (span) => {
    try {
      const body = await req.json()
      const validatedData = requestSchema.parse(body)
      const { message, chatId } = validatedData

      span.setAttributes({
        'chat.message_length': message.length,
        'chat.has_existing_id': !!chatId,
      })

      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ error: 'OpenAI API key is not configured' }, { status: 500 })
      }

      let currentChatId = chatId

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

      await prisma.message.create({
        data: {
          role: 'USER',
          content: message,
          chatId: currentChatId,
          userId: null,
        },
      })

      const previousMessages = await prisma.message.findMany({
        where: { chatId: currentChatId },
        orderBy: { createdAt: 'asc' },
        take: 20,
      })

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      })

      const messages = previousMessages.map((msg: { role: string; content: string }) => ({
        role: msg.role.toLowerCase() as 'user' | 'assistant' | 'system',
        content: msg.content,
      }))

      const stream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        stream: true,
      })

      let fullResponse = ''

      const encoder = new TextEncoder()
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ chatId: currentChatId })}\n\n`)
            )

            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content || ''
              if (content) {
                fullResponse += content
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
              }
            }

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

      console.error('Chat API error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
}
