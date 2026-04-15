'use client'

import { cn } from '@/lib/utils'

interface ChatMessageProps {
  role: 'USER' | 'ASSISTANT' | 'SYSTEM'
  content: string
  isStreaming?: boolean
}

export function ChatMessage({ role, content, isStreaming = false }: ChatMessageProps) {
  const isUser = role === 'USER'

  return (
    <div
      className={cn(
        'flex w-full gap-3 rounded-lg p-4',
        isUser ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-gray-800'
      )}
    >
      <div className="flex-shrink-0">
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold',
            isUser
              ? 'bg-blue-500 text-white'
              : 'bg-gray-300 text-gray-700 dark:bg-gray-600 dark:text-gray-200'
          )}
        >
          {isUser ? 'U' : 'A'}
        </div>
      </div>
      <div className="flex-1">
        <div className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
          {isUser ? 'You' : 'Assistant'}
        </div>
        <div className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
          {content}
          {isStreaming && (
            <span
              data-testid="streaming-indicator"
              className="ml-1 inline-block h-4 w-1 animate-pulse bg-gray-600 dark:bg-gray-400"
            />
          )}
        </div>
      </div>
    </div>
  )
}
