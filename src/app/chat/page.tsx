'use client'

import { useState, useEffect, useRef } from 'react'
import { Menu, Moon, Sun, Plus } from 'lucide-react'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { ChatInput } from '@/components/chat/ChatInput'
import { ChatHistory } from '@/components/chat/ChatHistory'
import { useTheme } from '@/providers/ThemeProvider'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'USER' | 'ASSISTANT'
  content: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadChatMessages = async (chatId: string) => {
    try {
      const response = await fetch(`/api/chat/${chatId}/messages`)
      const data = await response.json()
      setMessages(
        data.messages.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
        }))
      )
      setCurrentChatId(chatId)
      setShowHistory(false)
    } catch (error) {
      console.error('Failed to load chat messages:', error)
      setError('Failed to load chat messages')
    }
  }

  const handleSendMessage = async (content: string) => {
    setError(null)
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'USER',
      content,
    }

    setMessages((prev) => [...prev, userMessage])
    setIsStreaming(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          chatId: currentChatId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') {
                break
              }

              try {
                const parsed = JSON.parse(data)
                if (parsed.chatId && !currentChatId) {
                  setCurrentChatId(parsed.chatId)
                  // Refresh chat history to show the newly created chat
                  setHistoryRefreshTrigger((prev) => prev + 1)
                }
                if (parsed.content) {
                  assistantMessage += parsed.content
                  setMessages((prev) => {
                    const newMessages = [...prev]
                    const lastMessage = newMessages[newMessages.length - 1]
                    if (lastMessage?.role === 'ASSISTANT') {
                      lastMessage.content = assistantMessage
                    } else {
                      newMessages.push({
                        id: `assistant-${Date.now()}`,
                        role: 'ASSISTANT',
                        content: assistantMessage,
                      })
                    }
                    return newMessages
                  })
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e)
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setError('Failed to send message. Please try again.')
    } finally {
      setIsStreaming(false)
    }
  }

  const handleNewChat = () => {
    setCurrentChatId(null)
    setMessages([])
    setError(null)
    // Refresh history to ensure latest state
    setHistoryRefreshTrigger((prev) => prev + 1)
  }

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 transform border-r border-gray-200 bg-white transition-transform dark:border-gray-700 dark:bg-gray-800',
          showHistory ? 'translate-x-0' : '-translate-x-full',
          'lg:relative lg:translate-x-0'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-12 items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 lg:flex-1">Chat History</h2>
            <button
              onClick={() => setShowHistory(false)}
              className="rounded-lg py-1 px-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 lg:hidden"
              aria-label="Close history"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ChatHistory
              onSelectChat={loadChatMessages}
              currentChatId={currentChatId}
              refreshTrigger={historyRefreshTrigger}
              hasActiveChat={messages.length > 0 && currentChatId === null}
              activeChatName={messages[0]?.content.slice(0, 30) || 'New Chat'}
              onNewChatClick={handleNewChat}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <header className="flex h-12 items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <div className="flex items-center gap-4 lg:flex-1">
            <button
              data-testid="chat-history-toggle"
              onClick={() => setShowHistory(!showHistory)}
              className="lg:hidden"
              aria-label="Toggle chat history"
            >
              <Menu className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 lg:hidden">Chat</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleNewChat}
              className="flex items-center gap-2 rounded-lg bg-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-blue-600"
              aria-label="New chat"
            >
              <Plus className="h-4 w-4" />
              <span>New Chat</span>
            </button>
            <button
              data-testid="theme-toggle"
              onClick={toggleTheme}
              className="rounded-lg py-1 px-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
                <h2 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
                  Start a conversation
                </h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Send a message to begin chatting with the AI assistant
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.map((message, index) => (
                <ChatMessage
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  isStreaming={
                    isStreaming && index === messages.length - 1 && message.role === 'ASSISTANT'
                  }
                />
              ))}
              {error && (
                <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
                  Error: {error}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        <footer className="border-t border-gray-200 p-4 dark:border-gray-700">
          <div className="mx-auto max-w-3xl">
            <ChatInput onSend={handleSendMessage} disabled={isStreaming} />
          </div>
        </footer>
      </div>
    </div>
  )
}

function MessageSquare({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
