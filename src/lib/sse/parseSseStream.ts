import { SSE_DONE_SENTINEL } from './eventTypes'

export type SseFrame = { type: 'done' } | { type: 'data'; raw: string }

/**
 * Buffered SSE `data:` parser. Handles chunks that split mid-line and emits a
 * terminal `done` frame when the server sends the standard `[DONE]` sentinel.
 */
export async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal
): AsyncGenerator<SseFrame, void, void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      if (signal?.aborted) return
      const { done, value } = await reader.read()
      if (done) {
        buffer += decoder.decode()
        if (buffer.startsWith('data: ')) {
          const data = buffer.slice(6)
          if (data === SSE_DONE_SENTINEL) yield { type: 'done' }
          else if (data) yield { type: 'data', raw: data }
        }
        return
      }

      buffer += decoder.decode(value, { stream: true })
      let newlineIdx = buffer.indexOf('\n')
      while (newlineIdx !== -1) {
        const line = buffer.slice(0, newlineIdx)
        buffer = buffer.slice(newlineIdx + 1)

        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === SSE_DONE_SENTINEL) {
            yield { type: 'done' }
            return
          }
          yield { type: 'data', raw: data }
        }

        newlineIdx = buffer.indexOf('\n')
      }
    }
  } finally {
    reader.releaseLock()
  }
}
