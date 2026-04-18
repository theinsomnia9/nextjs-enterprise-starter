import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { z } from 'zod'
import { createSpan } from '@/lib/telemetry/tracing'
import { resolveChat, saveAssistantMessage } from '@/lib/chat/helpers'

const requestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  chatId: z.string().nullable(),
})

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
} as const

export async function POST(req: NextRequest) {
  return await createSpan('http.chat.create', async (span) => {
    try {
      const body = await req.json()
      const { message, chatId } = requestSchema.parse(body)

      span.setAttributes({
        'chat.message_length': message.length,
        'chat.has_existing_id': !!chatId,
      })

      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ error: 'OpenAI API key is not configured' }, { status: 500 })
      }

      const chat = await resolveChat(chatId, message)
      if (!chat) {
        return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
      }

      const messages = chat.previousMessages.map((msg) => ({
        role: msg.role.toLowerCase() as 'user' | 'assistant' | 'system',
        content: msg.content,
      }))

      const stream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
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
      console.error('Chat API error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
}
