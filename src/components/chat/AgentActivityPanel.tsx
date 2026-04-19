'use client'

import { useMemo, useState } from 'react'
import { Bot, CheckCircle2, ChevronDown, Loader2, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AgentActivity {
  id: string
  type: 'thinking' | 'tool_start' | 'tool_end'
  tool?: string
  input?: unknown
  output?: string
  message?: string
}

function formatToolInput(input: unknown): string {
  try {
    if (typeof input === 'string') {
      try {
        return formatToolInput(JSON.parse(input))
      } catch {
        return input
      }
    }

    if (input && typeof input === 'object') {
      const obj = input as Record<string, unknown>

      if ('input' in obj && typeof obj.input === 'string') {
        try {
          return JSON.stringify(JSON.parse(obj.input), null, 2)
        } catch {
          return obj.input as string
        }
      }
      if ('query' in obj) return String(obj.query)
      if ('expression' in obj) return String(obj.expression)

      const cleaned = Object.fromEntries(
        Object.entries(obj).filter(([k]) => !k.startsWith('_') && k !== 'type')
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
    if (parsed && typeof parsed === 'object') {
      if ('content' in parsed) {
        return typeof parsed.content === 'string'
          ? parsed.content
          : JSON.stringify(parsed.content, null, 2)
      }
      if (Array.isArray(parsed)) {
        return parsed
          .map((item, i) => `${i + 1}. ${item.title || item.content || JSON.stringify(item).slice(0, 100)}`)
          .join('\n')
      }
      if ('kwargs' in parsed && typeof parsed.kwargs === 'object' && parsed.kwargs) {
        const kwargs = parsed.kwargs as Record<string, unknown>
        if ('content' in kwargs) {
          return typeof kwargs.content === 'string'
            ? kwargs.content
            : JSON.stringify(kwargs.content, null, 2)
        }
        const cleaned = Object.fromEntries(
          Object.entries(kwargs).filter(([k]) => !k.startsWith('lc_') && k !== 'tool_call_id' && k !== 'name')
        )
        if (Object.keys(cleaned).length > 0) return JSON.stringify(cleaned, null, 2)
      }
      const cleaned = Object.fromEntries(
        Object.entries(parsed).filter(([k]) => !k.startsWith('lc_') && k !== 'type' && k !== 'id')
      )
      return Object.keys(cleaned).length > 0 ? JSON.stringify(cleaned, null, 2) : output
    }
    return output
  } catch {
    return output.length > 500 ? output.slice(0, 500) + '...' : output
  }
}

export function AgentActivityPanel({
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

  const grouped = useMemo(() => {
    const result: Array<{
      start: AgentActivity | null
      end: AgentActivity | null
      single?: AgentActivity
    }> = []

    activities.forEach((activity) => {
      if (activity.type === 'tool_start' && activity.tool) {
        result.push({ start: activity, end: null })
      } else if (activity.type === 'tool_end' && activity.tool) {
        const matchingGroup = result.find((g) => g.start?.tool === activity.tool && g.end === null)
        if (matchingGroup) {
          matchingGroup.end = activity
        } else {
          result.push({ start: null, end: activity })
        }
      } else if (activity.type === 'thinking') {
        result.push({ start: null, end: null, single: activity })
      }
    })

    return result
  }, [activities])

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

          if (group.start?.type === 'tool_start') {
            const toolId = group.start.id
            const isExpanded = expandedTools[toolId]
            const hasCompleted = group.end !== null

            return (
              <div key={toolId} className="rounded-lg border border-border/50 bg-background/50 p-3">
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

                {isExpanded && (
                  <div className="mt-3 space-y-2 border-t border-border/30 pt-2">
                    {group.start.input !== undefined && group.start.input !== null && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Input:</span>
                        <pre className="mt-1 max-h-32 overflow-auto rounded-md bg-secondary/50 p-2 text-xs">
                          {formatToolInput(group.start.input)}
                        </pre>
                      </div>
                    )}
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
