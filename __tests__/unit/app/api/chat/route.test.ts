import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'

vi.mock('openai', () => ({
  default: vi.fn(function () {
    return { chat: { completions: { create: vi.fn() } } }
  }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    chat: { create: vi.fn(), findUnique: vi.fn() },
    message: { create: vi.fn(), findMany: vi.fn() },
  },
}))

vi.mock('@/lib/chat/helpers', () => ({
  resolveChat: vi.fn(),
  saveAssistantMessage: vi.fn(),
}))

vi.mock('@/lib/telemetry/tracing', () => ({
  createSpan: vi.fn((_name: string, fn: (span: unknown) => unknown) =>
    fn({ setAttributes: vi.fn(), setStatus: vi.fn(), recordException: vi.fn(), end: vi.fn() })
  ),
}))

import { POST } from '@/app/api/chat/route'

describe('POST /api/chat', () => {
  it('returns 400 when message is missing', async () => {
    const request = new Request('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: null }),
    })

    const response = await POST(request as never)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBeDefined()
  })

  it('returns 400 when message is empty', async () => {
    const request = new Request('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '', chatId: null }),
    })

    const response = await POST(request as never)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBeDefined()
  })

  it('returns 500 when OpenAI API key is missing', async () => {
    const original = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY

    const request = new Request('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello', chatId: null }),
    })

    const response = await POST(request as never)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('OpenAI API key is not configured')

    process.env.OPENAI_API_KEY = original
  })

  it('validates request schema correctly', () => {
    const requestSchema = z.object({
      message: z.string().min(1, 'Message is required'),
      chatId: z.string().nullable(),
    })

    expect(() => requestSchema.parse({ message: 'Hello', chatId: null })).not.toThrow()
    expect(() => requestSchema.parse({ message: 'Hello', chatId: 'chat-123' })).not.toThrow()
    expect(() => requestSchema.parse({ message: '', chatId: null })).toThrow()
    expect(() => requestSchema.parse({ chatId: null })).toThrow()
  })
})
