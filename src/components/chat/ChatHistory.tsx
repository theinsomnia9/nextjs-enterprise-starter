'use client'

import { useCallback, useEffect, useState } from 'react'
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

  const fetchChatHistory = useCallback(async () => {
    try {
      const response = await fetch('/api/chat/history')
      const data = await response.json()
      setChats(data.chats || [])
    } catch (error) {
      console.error('Failed to fetch chat history:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchChatHistory()
  }, [fetchChatHistory, refreshTrigger])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (chats.length === 0) {
    return <div className="p-4 text-center text-sm text-muted-foreground">No chat history yet</div>
  }

  return (
    <div className="space-y-1 p-3">
      {hasActiveChat && currentChatId === null && (
        <button
          onClick={onNewChatClick}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg p-3 text-left',
            'interactive bg-primary text-primary-foreground'
          )}
          data-testid="new-chat-indicator"
        >
          <Plus className="h-4 w-4 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{activeChatName}</div>
            <div className="text-xs text-primary-foreground/70">Current conversation</div>
          </div>
        </button>
      )}
      {chats.map((chat) => (
        <button
          key={chat.id}
          onClick={() => onSelectChat(chat.id)}
          className={cn(
            'interactive flex w-full items-center gap-3 rounded-lg p-3 text-left',
            currentChatId === chat.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
          )}
        >
          <MessageSquare className="h-4 w-4 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{chat.name}</div>
            <div
              className={cn(
                'text-xs',
                currentChatId === chat.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
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
