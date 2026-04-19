import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { z } from 'zod'
import { createSpan } from '@/lib/telemetry/tracing'
import { resolveChat, saveAssistantMessage } from '@/lib/chat/helpers'
import { SSE_HEADERS, SSE_DONE_FRAME } from '@/lib/sse/eventTypes'

const requestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  chatId: z.string().nullable(),
})

let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return openaiClient
}


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

      const stream = await getOpenAIClient().chat.completions.create({
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

            controller.enqueue(encoder.encode(SSE_DONE_FRAME))
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
