import { z } from 'zod'
import { withApi } from '@/lib/api/withApi'
import { addSpanAttribute } from '@/lib/telemetry/tracing'
import { resolveChat, saveAssistantMessage } from '@/lib/chat/helpers'
import { SSE_HEADERS, SSE_DONE_FRAME } from '@/lib/sse/eventTypes'
import { notFound, validationError } from '@/lib/errors/AppError'
import { getChatClient, chatModelName } from '@/lib/ai'

const requestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  chatId: z.string().nullable(),
})

export const POST = withApi('http.chat.create', async (req) => {
  const body = await req.json()
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) throw validationError(parsed.error.issues[0].message)
  const { message, chatId } = parsed.data

  addSpanAttribute('chat.message_length', message.length)
  addSpanAttribute('chat.has_existing_id', !!chatId)

  const chat = await resolveChat(chatId, message)
  if (!chat) throw notFound('Chat', chatId ?? undefined)

  const messages = chat.previousMessages.map((msg) => ({
    role: msg.role.toLowerCase() as 'user' | 'assistant' | 'system',
    content: msg.content,
  }))

  const stream = await getChatClient().chat.completions.create({
    model: chatModelName(),
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
})
