import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../../../setup/test-utils'
import { ChatHistory } from '@/components/chat/ChatHistory'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('ChatHistory', () => {
  const mockOnSelectChat = vi.fn()

  beforeEach(() => {
    mockFetch.mockClear()
    mockOnSelectChat.mockClear()
    mockFetch.mockResolvedValue({
      json: async () => ({
        chats: [
          { id: '1', name: 'Chat 1', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
          { id: '2', name: 'Chat 2', createdAt: '2024-01-02', updatedAt: '2024-01-02' },
        ],
      }),
    })
  })

  it('should fetch and display chat history on mount', async () => {
    render(<ChatHistory onSelectChat={mockOnSelectChat} currentChatId={null} />)

    await waitFor(() => {
      expect(screen.getByText('Chat 1')).toBeInTheDocument()
      expect(screen.getByText('Chat 2')).toBeInTheDocument()
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/chat/history')
  })

  it('should highlight current chat', async () => {
    render(<ChatHistory onSelectChat={mockOnSelectChat} currentChatId="1" />)

    await waitFor(() => {
      expect(screen.getByText('Chat 1')).toBeInTheDocument()
    })

    const chatButtons = screen.getAllByRole('button')
    const chat1Button = chatButtons.find((btn) => btn.textContent?.includes('Chat 1'))

    expect(chat1Button).toHaveClass('bg-blue-500')
  })

  it('should call onSelectChat when a chat is clicked', async () => {
    render(<ChatHistory onSelectChat={mockOnSelectChat} currentChatId={null} />)

    await waitFor(() => {
      expect(screen.getByText('Chat 1')).toBeInTheDocument()
    })

    const chatButtons = screen.getAllByRole('button')
    const chat1Button = chatButtons.find((btn) => btn.textContent?.includes('Chat 1'))

    fireEvent.click(chat1Button!)

    expect(mockOnSelectChat).toHaveBeenCalledWith('1')
  })

  it('should show loading state initially', () => {
    render(<ChatHistory onSelectChat={mockOnSelectChat} currentChatId={null} />)

    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('should show empty state when no chats exist', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ chats: [] }),
    })

    render(<ChatHistory onSelectChat={mockOnSelectChat} currentChatId={null} />)

    await waitFor(() => {
      expect(screen.getByText(/no chat history yet/i)).toBeInTheDocument()
    })
  })

  it('should refresh chat history when refreshTrigger changes', async () => {
    const { rerender } = render(
      <ChatHistory onSelectChat={mockOnSelectChat} currentChatId={null} refreshTrigger={0} />
    )

    await waitFor(() => {
      expect(screen.getByText('Chat 1')).toBeInTheDocument()
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Update refreshTrigger
    rerender(
      <ChatHistory onSelectChat={mockOnSelectChat} currentChatId={null} refreshTrigger={1} />
    )

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  it('should show new chat indicator when currentChatId is null and hasMessages is true', async () => {
    render(
      <ChatHistory
        onSelectChat={mockOnSelectChat}
        currentChatId={null}
        hasActiveChat={true}
        activeChatName="New Conversation"
      />
    )

    await waitFor(() => {
      expect(screen.getByText('New Conversation')).toBeInTheDocument()
    })

    const newChatIndicator = screen.getByText('New Conversation').closest('button')
    expect(newChatIndicator).toHaveClass('bg-blue-500')
  })

  it('should not show new chat indicator when hasActiveChat is false', async () => {
    render(
      <ChatHistory onSelectChat={mockOnSelectChat} currentChatId={null} hasActiveChat={false} />
    )

    await waitFor(() => {
      expect(screen.queryByText(/new conversation/i)).not.toBeInTheDocument()
    })
  })

  it('should handle fetch error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    render(<ChatHistory onSelectChat={mockOnSelectChat} currentChatId={null} />)

    await waitFor(() => {
      expect(screen.getByText(/no chat history yet/i)).toBeInTheDocument()
    })
  })
})
