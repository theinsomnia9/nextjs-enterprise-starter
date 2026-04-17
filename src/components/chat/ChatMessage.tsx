'use client'

import ReactMarkdown from 'react-markdown'
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
        {isUser ? (
          <div className="whitespace-pre-wrap text-sm text-foreground/90">{content}</div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground/90">
            <ReactMarkdown
              components={{
                a: ({ ...props }) => (
                  <a
                    {...props}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline hover:text-primary/80"
                  />
                ),
                ul: ({ ...props }) => <ul {...props} className="my-2 list-disc space-y-1 pl-4" />,
                ol: ({ ...props }) => <ol {...props} className="my-2 list-decimal space-y-1 pl-4" />,
                li: ({ ...props }) => <li {...props} className="leading-relaxed" />,
                p: ({ ...props }) => <p {...props} className="my-2 leading-relaxed" />,
                strong: ({ ...props }) => <strong {...props} className="font-semibold text-foreground" />,
                h1: ({ ...props }) => <h1 {...props} className="my-3 text-lg font-bold" />,
                h2: ({ ...props }) => <h2 {...props} className="my-2 text-base font-semibold" />,
                h3: ({ ...props }) => <h3 {...props} className="my-2 text-sm font-semibold" />,
                code: ({ ...props }) => (
                  <code {...props} className="rounded bg-secondary/50 px-1.5 py-0.5 text-xs font-mono" />
                ),
                pre: ({ ...props }) => (
                  <pre {...props} className="my-2 overflow-x-auto rounded-lg bg-secondary/30 p-3" />
                ),
              }}
            >
              {content}
            </ReactMarkdown>
            {isStreaming && (
              <span
                data-testid="streaming-indicator"
                className="ml-1 inline-block h-4 w-1 animate-pulse bg-muted-foreground"
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
