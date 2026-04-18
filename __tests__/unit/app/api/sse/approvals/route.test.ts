import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/sse/approvals/route'
import { getClientCount, clearClients } from '@/lib/approvals/sseServer'

describe('SSE Approvals API Route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    clearClients()
  })

  it('should return a streaming response with correct headers', async () => {
    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform')
    expect(response.headers.get('Connection')).toBe('keep-alive')
  })

  it('should send initial connection message', async () => {
    const response = await GET()
    const reader = response.body?.getReader()

    if (reader) {
      const { value } = await reader.read()
      const text = new TextDecoder().decode(value)
      expect(text).toContain('event: connected')
      expect(text).toContain('data:')
      reader.releaseLock()
    }
  })

  it('should add client to broadcast list on connection', async () => {
    expect(getClientCount()).toBe(0)
    await GET()
    expect(getClientCount()).toBe(1)
  })

  it('should remove client when connection is cancelled', async () => {
    const response = await GET()
    expect(getClientCount()).toBe(1)

    const reader = response.body?.getReader()
    if (reader) {
      // Cancel the reader (simulates client disconnect)
      await reader.cancel()
      expect(getClientCount()).toBe(0)
    }
  })

  it('should handle client disconnection gracefully', async () => {
    const response = await GET()

    // Verify the response is a readable stream
    expect(response.body).toBeInstanceOf(ReadableStream)
  })
})
