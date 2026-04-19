'use client'

import { useState, useEffect, useRef } from 'react'
import { Menu, MessageSquare, Moon, Sun, Plus, Bot, BotOff } from 'lucide-react'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { ChatInput } from '@/components/chat/ChatInput'
import { ChatHistory } from '@/components/chat/ChatHistory'
import { AgentActivityPanel, type AgentActivity } from '@/components/chat/AgentActivityPanel'
import { useTheme } from '@/providers/ThemeProvider'
import { useSingleflightAbort } from '@/hooks/useSingleflightAbort'
import { parseSseStream } from '@/lib/sse/parseSseStream'
import { AGENT_STREAM_EVENTS } from '@/lib/sse/eventTypes'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'USER' | 'ASSISTANT'
  content: string
}

const clearThinking = (activities: AgentActivity[]) =>
  activities.some((a) => a.type === 'thinking')
    ? activities.filter((a) => a.type !== 'thinking')
    : activities

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0)
  const [agentMode, setAgentMode] = useState(false)
  const [agentActivity, setAgentActivity] = useState<AgentActivity[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const startStream = useSingleflightAbort()
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
    const controller = startStream()

    setError(null)
    setAgentActivity([]) // Clear previous activity
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'USER',
      content,
    }

    setMessages((prev) => [...prev, userMessage])
    setIsStreaming(true)

    try {
      const endpoint = agentMode ? '/api/chat/agent' : '/api/chat'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          chatId: currentChatId,
          ...(agentMode && currentChatId ? { threadId: currentChatId } : {}),
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      if (!response.body) throw new Error('Missing response body')
      let assistantMessage = ''

      for await (const frame of parseSseStream(response.body, controller.signal)) {
        if (frame.type === 'done') {
          setAgentActivity(clearThinking)
          break
        }

        let parsed: {
          chatId?: string
          type?: string
          content?: string
          tool?: string
          input?: unknown
          output?: string
          message?: string
        }
        try {
          parsed = JSON.parse(frame.raw)
        } catch (e) {
          console.error('Failed to parse SSE data:', e)
          continue
        }

        if (parsed.chatId && !currentChatId) {
          setCurrentChatId(parsed.chatId)
          setHistoryRefreshTrigger((prev) => prev + 1)
        }

        if (
          parsed.type === AGENT_STREAM_EVENTS.THINKING ||
          parsed.type === AGENT_STREAM_EVENTS.TOOL_START ||
          parsed.type === AGENT_STREAM_EVENTS.TOOL_END
        ) {
          const eventType = parsed.type
          setAgentActivity((prev) => {
            const base =
              eventType === AGENT_STREAM_EVENTS.TOOL_START ||
              eventType === AGENT_STREAM_EVENTS.TOOL_END
                ? clearThinking(prev)
                : prev

            return [
              ...base,
              {
                id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                type: eventType,
                tool: parsed.tool,
                input: parsed.input,
                output: parsed.output,
                message: parsed.message,
              },
            ]
          })
        }

        if (
          (parsed.type === AGENT_STREAM_EVENTS.TOKEN || parsed.type === undefined) &&
          parsed.content
        ) {
          assistantMessage += parsed.content
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (last?.role === 'ASSISTANT') {
              return [...prev.slice(0, -1), { ...last, content: assistantMessage }]
            }
            return [
              ...prev,
              {
                id: `assistant-${Date.now()}`,
                role: 'ASSISTANT',
                content: assistantMessage,
              },
            ]
          })
        }
      }
    } catch (error) {
      if (controller.signal.aborted) return
      console.error('Error sending message:', error)
      setError('Failed to send message. Please try again.')
    } finally {
      if (!controller.signal.aborted) {
        setIsStreaming(false)
        setAgentActivity(clearThinking)
      }
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
    <div className="flex h-screen bg-background">
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 transform border-r border-border bg-card transition-transform',
          showHistory ? 'translate-x-0' : '-translate-x-full',
          'lg:relative lg:translate-x-0'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-12 items-center justify-between border-b border-border p-4">
            <h2 className="text-lg font-semibold lg:flex-1">Chat History</h2>
            {showHistory && (
              <button
                onClick={() => setShowHistory(false)}
                className="interactive rounded-lg p-2 text-muted-foreground hover:bg-accent lg:hidden"
                aria-label="Close history"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
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

      <div
        className={cn(
          'flex flex-1 flex-col',
          showHistory && 'ml-64 transition-all duration-300 lg:ml-0'
        )}
      >
        <header className="flex h-12 items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-4 lg:flex-1">
            {!showHistory && (
              <button
                data-testid="chat-history-toggle"
                onClick={() => setShowHistory(!showHistory)}
                className="interactive rounded-lg p-2 text-muted-foreground hover:bg-accent lg:hidden"
                aria-label="Toggle chat history"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <h1 className="text-xl font-semibold lg:hidden">Chat</h1>
          </div>
          <div className="flex items-center gap-2">
            {agentMode && (
              <span
                data-testid="agent-mode-badge"
                className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
              >
                Agent
              </span>
            )}
            <button
              data-testid="agent-mode-toggle"
              onClick={() => setAgentMode(!agentMode)}
              className={cn(
                'interactive rounded-lg p-2',
                agentMode
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'text-muted-foreground hover:bg-accent'
              )}
              aria-label={agentMode ? 'Disable agent mode' : 'Enable agent mode'}
              aria-pressed={agentMode}
            >
              {agentMode ? <Bot className="h-5 w-5" /> : <BotOff className="h-5 w-5" />}
            </button>
            <button
              onClick={handleNewChat}
              className="interactive flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              aria-label="New chat"
            >
              <Plus className="h-4 w-4" />
              <span>New Chat</span>
            </button>
            <button
              data-testid="theme-toggle"
              onClick={toggleTheme}
              className="interactive rounded-lg p-2 text-muted-foreground hover:bg-accent"
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
                <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
                <h2 className="mt-4 text-lg font-medium">Start a conversation</h2>
                <p className="mt-2 text-sm text-muted-foreground">
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

              {/* Agent Activity Feed - shows thinking, tool calls */}
              {agentMode && agentActivity.length > 0 && (
                <AgentActivityPanel activities={agentActivity} isStreaming={isStreaming} />
              )}

              {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                  Error: {error}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        <footer className="border-t border-border p-4">
          <div className="mx-auto max-w-3xl">
            <ChatInput onSend={handleSendMessage} disabled={isStreaming} />
          </div>
        </footer>
      </div>
    </div>
  )
}

