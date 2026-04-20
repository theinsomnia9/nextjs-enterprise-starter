import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/chat/[chatId]/messages/route'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    message: {
      findMany: vi.fn(),
    },
  },
}))

describe('GET /api/chat/[chatId]/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return messages for a chat', async () => {
    const chatId = 'chat-123'
    const mockMessages = [
      {
        id: 'msg-1',
        role: 'USER',
        content: 'Hello',
        chatId,
        userId: null,
        createdAt: new Date('2024-01-01T10:00:00'),
      },
      {
        id: 'msg-2',
        role: 'ASSISTANT',
        content: 'Hi there!',
        chatId,
        userId: null,
        createdAt: new Date('2024-01-01T10:00:01'),
      },
    ]

    vi.mocked(prisma.message.findMany).mockResolvedValue(mockMessages as any)

    const request = new Request(`http://localhost:3000/api/chat/${chatId}/messages`)
    const response = await GET(request, { params: Promise.resolve({ chatId }) })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.messages).toHaveLength(2)
    expect(data.messages[0].role).toBe('USER')
    expect(data.messages[1].role).toBe('ASSISTANT')
    expect(prisma.message.findMany).toHaveBeenCalledWith({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      take: 200,
    })
  })

  it('should return empty array when no messages exist', async () => {
    const chatId = 'chat-123'
    vi.mocked(prisma.message.findMany).mockResolvedValue([])

    const request = new Request(`http://localhost:3000/api/chat/${chatId}/messages`)
    const response = await GET(request, { params: Promise.resolve({ chatId }) })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.messages).toHaveLength(0)
  })

  it('should return 500 on database error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const chatId = 'chat-123'
    vi.mocked(prisma.message.findMany).mockRejectedValue(new Error('Database error'))

    const request = new Request(`http://localhost:3000/api/chat/${chatId}/messages`)
    const response = await GET(request, { params: Promise.resolve({ chatId }) })

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.code).toBe('INTERNAL_ERROR')
    errorSpy.mockRestore()
  })
})
