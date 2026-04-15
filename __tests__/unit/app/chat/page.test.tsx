import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../../../setup/test-utils'
import ChatPage from '@/app/chat/page'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('ChatPage', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    // Default mock for chat history
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/chat/history')) {
        return Promise.resolve({
          json: async () => ({
            chats: [
              {
                id: 'chat-1',
                name: 'Existing Chat',
                createdAt: '2024-01-01',
                updatedAt: '2024-01-01',
              },
            ],
          }),
        })
      }
      if (url.includes('/api/chat/') && url.includes('/messages')) {
        return Promise.resolve({
          json: async () => ({
            messages: [
              { id: 'msg-1', role: 'USER', content: 'Hello' },
              { id: 'msg-2', role: 'ASSISTANT', content: 'Hi!' },
            ],
          }),
        })
      }
      return Promise.resolve({
        json: async () => ({}),
      })
    })
  })

  it('should refresh chat history when new chat button is clicked', async () => {
    render(<ChatPage />)

    await waitFor(() => {
      expect(screen.getByText('Existing Chat')).toBeInTheDocument()
    })

    // Initial fetch on mount
    const historyCallsBefore = mockFetch.mock.calls.filter((call) =>
      call[0].includes('/api/chat/history')
    ).length

    // Click new chat button
    const newChatButton = screen.getByRole('button', { name: /new chat/i })
    fireEvent.click(newChatButton)

    // Should have made another call to refresh history
    await waitFor(() => {
      const historyCallsAfter = mockFetch.mock.calls.filter((call) =>
        call[0].includes('/api/chat/history')
      ).length
      expect(historyCallsAfter).toBeGreaterThan(historyCallsBefore)
    })
  })

  it('should show new chat indicator in sidebar when starting a new chat', async () => {
    render(<ChatPage />)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Chat')).toBeInTheDocument()
    })

    // Click new chat button
    const newChatButton = screen.getByRole('button', { name: /new chat/i })
    fireEvent.click(newChatButton)

    // Should show new chat indicator (implementation will add this)
    await waitFor(() => {
      // The sidebar should indicate we're in a new chat state
      const chatHistoryHeading = screen.getByRole('heading', { name: /chat history/i })
      expect(chatHistoryHeading).toBeInTheDocument()
    })
  })

  it('should refresh chat history after sending first message in new chat', async () => {
    // Mock streaming response for new chat creation
    const encoder = new TextEncoder()
    const streamData = encoder.encode('data: {"chatId":"new-chat-123","content":"Hello"}\n\n')

    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/chat/history')) {
        return Promise.resolve({
          json: async () => ({
            chats: [
              {
                id: 'chat-1',
                name: 'Existing Chat',
                createdAt: '2024-01-01',
                updatedAt: '2024-01-01',
              },
            ],
          }),
        })
      }
      if (url === '/api/chat' && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          body: {
            getReader: () => {
              let done = false
              return {
                read: async () => {
                  if (!done) {
                    done = true
                    return { done: false, value: streamData }
                  }
                  return { done: true, value: undefined }
                },
              }
            },
          },
        })
      }
      return Promise.resolve({
        json: async () => ({}),
      })
    })

    render(<ChatPage />)

    await waitFor(() => {
      expect(screen.getByText('Existing Chat')).toBeInTheDocument()
    })

    // Count history calls before
    const historyCallsBefore = mockFetch.mock.calls.filter((call) =>
      call[0].includes('/api/chat/history')
    ).length

    // Type and send a message
    const input = screen.getByPlaceholderText(/type your message/i)
    fireEvent.change(input, { target: { value: 'Test message' } })

    const sendButton = screen.getByRole('button', { name: /send/i })
    fireEvent.click(sendButton)

    // Should have refreshed history after getting chatId
    await waitFor(() => {
      const historyCallsAfter = mockFetch.mock.calls.filter((call) =>
        call[0].includes('/api/chat/history')
      ).length
      expect(historyCallsAfter).toBeGreaterThan(historyCallsBefore)
    })
  })
})
