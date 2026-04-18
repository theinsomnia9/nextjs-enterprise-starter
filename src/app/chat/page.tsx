'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Menu,
  Moon,
  Sun,
  Plus,
  Bot,
  BotOff,
  Loader2,
  Wrench,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { ChatInput } from '@/components/chat/ChatInput'
import { ChatHistory } from '@/components/chat/ChatHistory'
import { useTheme } from '@/providers/ThemeProvider'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'USER' | 'ASSISTANT'
  content: string
  meta?: {
    type: 'thinking' | 'tool_start' | 'tool_end'
    tool?: string
    input?: unknown
    output?: string
    message?: string
  }
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0)
  const [agentMode, setAgentMode] = useState(false)
  const [agentActivity, setAgentActivity] = useState<
    Array<{
      id: string
      type: 'thinking' | 'tool_start' | 'tool_end'
      tool?: string
      input?: unknown
      output?: string
      message?: string
    }>
  >([])
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
                // Clear all thinking states when done
                setAgentActivity((prev) => prev.filter((a) => a.type !== 'thinking'))
                break
              }

              try {
                const parsed = JSON.parse(data)
                if (parsed.chatId && !currentChatId) {
                  setCurrentChatId(parsed.chatId)
                  // Refresh chat history to show the newly created chat
                  setHistoryRefreshTrigger((prev) => prev + 1)
                }

                // Handle agent events (thinking, tools)
                if (
                  parsed.type === 'thinking' ||
                  parsed.type === 'tool_start' ||
                  parsed.type === 'tool_end'
                ) {
                  setAgentActivity((prev) => {
                    // Remove previous 'thinking' entries when tool starts or ends
                    const filtered =
                      parsed.type === 'tool_start' || parsed.type === 'tool_end'
                        ? prev.filter((a) => a.type !== 'thinking')
                        : prev

                    return [
                      ...filtered,
                      {
                        id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                        type: parsed.type,
                        tool: parsed.tool,
                        input: parsed.input,
                        output: parsed.output,
                        message: parsed.message,
                      },
                    ]
                  })
                }

                // Handle token streaming (both agent API and regular API formats)
                if ((parsed.type === 'token' || parsed.type === undefined) && parsed.content) {
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
      // Clear any remaining thinking states
      setAgentActivity((prev) => prev.filter((a) => a.type !== 'thinking'))
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

interface AgentActivity {
  id: string
  type: 'thinking' | 'tool_start' | 'tool_end'
  tool?: string
  input?: unknown
  output?: string
  message?: string
}

function AgentActivityPanel({
  activities,
  isStreaming,
}: {
  activities: AgentActivity[]
  isStreaming: boolean
}) {
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({})

  const toggleTool = (id: string) => {
    setExpandedTools((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Group tool_start and tool_end together using name-based matching
  const pendingTools = new Map<string, AgentActivity>()
  const grouped: Array<{
    start: AgentActivity | null
    end: AgentActivity | null
    single?: AgentActivity
  }> = []

  activities.forEach((activity) => {
    if (activity.type === 'tool_start' && activity.tool) {
      pendingTools.set(activity.tool, activity)
      grouped.push({ start: activity, end: null })
    } else if (activity.type === 'tool_end' && activity.tool) {
      // Find matching pending tool by name
      const matchingGroup = grouped.find((g) => g.start?.tool === activity.tool && g.end === null)
      if (matchingGroup) {
        matchingGroup.end = activity
      } else {
        // Orphaned end event, create group without start
        grouped.push({ start: null, end: activity })
      }
    } else if (activity.type === 'thinking') {
      grouped.push({ start: null, end: null, single: activity })
    }
  })

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-muted p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-3 w-3 text-primary" />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">
          Agent Reasoning
        </span>
        {isStreaming && (
          <span className="ml-2 inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
        )}
      </div>

      <div className="space-y-3">
        {grouped.map((group, idx) => {
          // Thinking state
          if (group.single?.type === 'thinking') {
            const isLastThinking = idx === grouped.length - 1 && isStreaming
            return (
              <div
                key={group.single.id}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                {isLastThinking ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-primary/30 bg-primary/10" />
                )}
                <span className="italic">{group.single.message}</span>
              </div>
            )
          }

          // Tool execution
          if (group.start?.type === 'tool_start') {
            const toolId = group.start.id
            const isExpanded = expandedTools[toolId]
            const hasCompleted = group.end !== null

            return (
              <div key={toolId} className="rounded-lg border border-border/50 bg-background/50 p-3">
                {/* Tool Header */}
                <button
                  onClick={() => toggleTool(toolId)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full',
                        hasCompleted ? 'bg-green-500/10' : 'bg-primary/10'
                      )}
                    >
                      {hasCompleted ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Wrench className="h-3.5 w-3.5 text-primary" />
                      )}
                    </div>
                    <div>
                      <span className="text-sm font-medium">{group.start.tool}</span>
                      {!hasCompleted && isStreaming && (
                        <span className="ml-2 text-xs text-muted-foreground">running...</span>
                      )}
                    </div>
                  </div>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-muted-foreground transition-transform',
                      isExpanded && 'rotate-180'
                    )}
                  />
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-3 space-y-2 border-t border-border/30 pt-2">
                    {/* Input */}
                    {group.start.input !== undefined && group.start.input !== null && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Input:</span>
                        <pre className="mt-1 max-h-32 overflow-auto rounded-md bg-secondary/50 p-2 text-xs">
                          {formatToolInput(group.start.input)}
                        </pre>
                      </div>
                    )}

                    {/* Output */}
                    {hasCompleted && group.end?.output && (
                      <div>
                        <span className="text-xs font-medium text-green-600">Output:</span>
                        <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-green-500/5 p-2 text-xs">
                          {formatToolOutput(group.end.output)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          }

          return null
        })}
      </div>
    </div>
  )
}

function formatToolInput(input: unknown): string {
  try {
    // Handle double-serialized JSON strings
    if (typeof input === 'string') {
      try {
        const parsed = JSON.parse(input)
        return formatToolInput(parsed)
      } catch {
        return input
      }
    }

    if (input && typeof input === 'object') {
      // Extract meaningful fields, skipping wrapper objects
      const obj = input as Record<string, unknown>

      // If it has 'input' field with nested content, extract that
      if ('input' in obj && typeof obj.input === 'string') {
        try {
          const inner = JSON.parse(obj.input)
          return JSON.stringify(inner, null, 2)
        } catch {
          return obj.input as string
        }
      }

      // If it has query or expression, return that directly
      if ('query' in obj) {
        return String(obj.query)
      }
      if ('expression' in obj) {
        return String(obj.expression)
      }

      // Clean up internal fields
      const cleaned = Object.entries(obj).reduce(
        (acc, [key, val]) => {
          if (!key.startsWith('_') && key !== 'type') {
            acc[key] = val
          }
          return acc
        },
        {} as Record<string, unknown>
      )
      return JSON.stringify(cleaned, null, 2)
    }

    return String(input)
  } catch {
    return String(input)
  }
}

function formatToolOutput(output: string): string {
  try {
    const parsed = JSON.parse(output)
    // Handle LangChain serialized objects
    if (parsed && typeof parsed === 'object') {
      // If it has a 'content' field (like AIMessage), return that
      if ('content' in parsed) {
        return typeof parsed.content === 'string'
          ? parsed.content
          : JSON.stringify(parsed.content, null, 2)
      }
      // If it's an array of search results, format nicely
      if (Array.isArray(parsed)) {
        return parsed
          .map(
            (item, i) =>
              `${i + 1}. ${item.title || item.content || JSON.stringify(item).slice(0, 100)}`
          )
          .join('\n')
      }
      // If it has kwargs with content, extract that
      if ('kwargs' in parsed && typeof parsed.kwargs === 'object' && parsed.kwargs) {
        const kwargs = parsed.kwargs as Record<string, unknown>
        if ('content' in kwargs) {
          return typeof kwargs.content === 'string'
            ? kwargs.content
            : JSON.stringify(kwargs.content, null, 2)
        }
        // Return cleaned kwargs
        const cleaned = Object.entries(kwargs).reduce(
          (acc, [key, val]) => {
            if (!key.startsWith('lc_') && key !== 'tool_call_id' && key !== 'name') {
              acc[key] = val
            }
            return acc
          },
          {} as Record<string, unknown>
        )
        if (Object.keys(cleaned).length > 0) {
          return JSON.stringify(cleaned, null, 2)
        }
      }
      // Return formatted JSON without internal fields
      const cleaned = Object.entries(parsed).reduce(
        (acc, [key, val]) => {
          if (!key.startsWith('lc_') && key !== 'type' && key !== 'id') {
            acc[key] = val
          }
          return acc
        },
        {} as Record<string, unknown>
      )
      return Object.keys(cleaned).length > 0 ? JSON.stringify(cleaned, null, 2) : output
    }
    return output
  } catch {
    // Not JSON, return as-is but truncate if needed
    return output.length > 500 ? output.slice(0, 500) + '...' : output
  }
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
