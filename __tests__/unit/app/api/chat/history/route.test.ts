import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/chat/history/route'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    chat: {
      findMany: vi.fn(),
    },
  },
}))

describe('GET /api/chat/history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return list of chats', async () => {
    const mockChats = [
      {
        id: 'chat-1',
        name: 'Chat 1',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 'chat-2',
        name: 'Chat 2',
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
      },
    ]

    vi.mocked(prisma.chat.findMany).mockResolvedValue(mockChats)

    const request = new Request('http://localhost:3000/api/chat/history')
    const response = await GET(request, { params: Promise.resolve({}) })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.chats).toHaveLength(2)
    expect(data.chats[0].id).toBe('chat-1')
    expect(prisma.chat.findMany).toHaveBeenCalledWith({
      orderBy: { updatedAt: 'desc' },
      take: 50,
    })
  })

  it('should return empty array when no chats exist', async () => {
    vi.mocked(prisma.chat.findMany).mockResolvedValue([])

    const request = new Request('http://localhost:3000/api/chat/history')
    const response = await GET(request, { params: Promise.resolve({}) })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.chats).toHaveLength(0)
  })

  it('should return 500 on database error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(prisma.chat.findMany).mockRejectedValue(new Error('Database error'))

    const request = new Request('http://localhost:3000/api/chat/history')
    const response = await GET(request, { params: Promise.resolve({}) })

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.code).toBe('INTERNAL_ERROR')
    errorSpy.mockRestore()
  })
})
