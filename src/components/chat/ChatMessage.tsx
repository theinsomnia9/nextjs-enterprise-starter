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
    <div className={cn('flex w-full gap-3 rounded-lg p-4', isUser ? 'bg-primary/5' : 'bg-muted')}>
      <div className="flex-shrink-0">
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold',
            isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
          )}
        >
          {isUser ? 'U' : 'A'}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-sm font-semibold">{isUser ? 'You' : 'Assistant'}</div>
        <div className="whitespace-pre-wrap text-sm text-foreground/90">
          {content}
          {isStreaming && (
            <span
              data-testid="streaming-indicator"
              className="ml-1 inline-block h-4 w-1 animate-pulse bg-muted-foreground"
            />
          )}
        </div>
      </div>
    </div>
  )
}
