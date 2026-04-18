import { addClient, removeClient } from '@/lib/approvals/sseServer'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const encoder = new TextEncoder()
  let writer: WritableStreamDefaultWriter<string>
  let keepAliveInterval: NodeJS.Timeout

  const stream = new ReadableStream({
    start(controller) {
      writer = {
        write: (chunk: string) => {
          controller.enqueue(encoder.encode(chunk))
          return Promise.resolve()
        },
        close: () => {
          controller.close()
          return Promise.resolve()
        },
        releaseLock: () => {},
        closed: Promise.resolve(undefined),
        desiredSize: 1,
        ready: Promise.resolve(undefined),
        abort: () => Promise.resolve(),
      } as WritableStreamDefaultWriter<string>

      // Add client to the broadcast list
      addClient(writer)

      // Send initial connection message
      const connectMessage = `event: connected\ndata: ${JSON.stringify({ message: 'Connected to approval events' })}\n\n`
      controller.enqueue(encoder.encode(connectMessage))

      // Keep-alive ping every 30 seconds to prevent connection timeout
      keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(':ping\n\n'))
        } catch {
          // Connection closed, clean up
          clearInterval(keepAliveInterval)
          removeClient(writer)
        }
      }, 30000)
    },

    cancel() {
      // Client disconnected - clean up
      clearInterval(keepAliveInterval)
      if (writer) {
        removeClient(writer)
      }
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
