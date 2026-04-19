import { addClient, removeClient, type SSEClient } from '@/lib/approvals/sseServer'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  let client: SSEClient | null = null
  let keepAlive: NodeJS.Timeout | null = null

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      client = { controller, encoder }
      addClient(client)

      controller.enqueue(
        encoder.encode(
          `event: connected\ndata: ${JSON.stringify({ message: 'Connected to approval events' })}\n\n`
        )
      )

      keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(':ping\n\n'))
        } catch {
          if (keepAlive) clearInterval(keepAlive)
          if (client) removeClient(client)
        }
      }, 30000)
    },

    cancel() {
      if (keepAlive) clearInterval(keepAlive)
      if (client) removeClient(client)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
