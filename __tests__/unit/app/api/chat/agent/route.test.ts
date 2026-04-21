import { describe, it, expect } from 'vitest'
import { POST } from '@/app/api/chat/agent/route'
import { z } from 'zod'

describe('POST /api/chat/agent', () => {

  it('should return 400 when message is missing', async () => {
    const request = new Request('http://localhost:3000/api/chat/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: null }),
    })

    const response = await POST(request, { params: Promise.resolve({}) })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBeDefined()
  })

  it('should return 400 when message is empty', async () => {
    const request = new Request('http://localhost:3000/api/chat/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '', chatId: null }),
    })

    const response = await POST(request, { params: Promise.resolve({}) })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBeDefined()
  })


  it('should validate request schema correctly', () => {
    const requestSchema = z.object({
      message: z.string().min(1, 'Message is required'),
      chatId: z.string().nullable(),
      threadId: z.string().optional(),
    })

    expect(() => requestSchema.parse({ message: 'Hello', chatId: null })).not.toThrow()
    expect(() => requestSchema.parse({ message: 'Hello', chatId: 'chat-123' })).not.toThrow()
    expect(() =>
      requestSchema.parse({ message: 'Hello', chatId: null, threadId: 'thread-1' })
    ).not.toThrow()
    expect(() => requestSchema.parse({ message: '', chatId: null })).toThrow()
    expect(() => requestSchema.parse({ chatId: null })).toThrow()
  })
})
