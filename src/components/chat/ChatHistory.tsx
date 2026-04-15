'use client'

import { useEffect, useState } from 'react'
import { MessageSquare, Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Chat {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

interface ChatHistoryProps {
  onSelectChat: (chatId: string) => void
  currentChatId: string | null
  refreshTrigger?: number
  hasActiveChat?: boolean
  activeChatName?: string
  onNewChatClick?: () => void
}

export function ChatHistory({
  onSelectChat,
  currentChatId,
  refreshTrigger = 0,
  hasActiveChat = false,
  activeChatName = 'New Chat',
  onNewChatClick,
}: ChatHistoryProps) {
  const [chats, setChats] = useState<Chat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchChatHistory()
  }, [refreshTrigger])

  const fetchChatHistory = async () => {
    try {
      const response = await fetch('/api/chat/history')
      const data = await response.json()
      setChats(data.chats || [])
    } catch (error) {
      console.error('Failed to fetch chat history:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (chats.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
        No chat history yet
      </div>
    )
  }

  return (
    <div className="space-y-2 p-4">
      {hasActiveChat && currentChatId === null && (
        <button
          onClick={onNewChatClick}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors',
            'bg-blue-500 text-white'
          )}
          data-testid="new-chat-indicator"
        >
          <Plus className="h-4 w-4 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{activeChatName}</div>
            <div className="text-xs text-blue-100">Current conversation</div>
          </div>
        </button>
      )}
      {chats.map((chat) => (
        <button
          key={chat.id}
          onClick={() => onSelectChat(chat.id)}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors',
            currentChatId === chat.id
              ? 'bg-blue-500 text-white'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
          )}
        >
          <MessageSquare className="h-4 w-4 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{chat.name}</div>
            <div
              className={cn(
                'text-xs',
                currentChatId === chat.id ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
              )}
            >
              {new Date(chat.updatedAt).toLocaleDateString()}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
