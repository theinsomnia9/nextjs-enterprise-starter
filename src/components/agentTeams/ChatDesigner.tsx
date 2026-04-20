'use client'

import { useState } from 'react'
import { designTeam } from '@/lib/api/agentTeams'
import type { TeamDefinition } from '@/lib/agentTeams/types'

export interface ChatDesignerProps {
  definition: TeamDefinition
  onProposal: (next: TeamDefinition, rationale: string) => void
}

interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export function ChatDesigner({ definition, onProposal }: ChatDesignerProps) {
  const [history, setHistory] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    const message = input.trim()
    if (!message) return
    setLoading(true)
    setError(null)
    const nextHistory = [...history, { role: 'user' as const, content: message }]
    setHistory(nextHistory)
    setInput('')
    try {
      const res = await designTeam({
        message,
        definition,
        history: nextHistory,
      })
      setHistory([...nextHistory, { role: 'assistant', content: res.reply }])
      onProposal(res.nextDefinition, res.reply)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full w-full flex-col" data-testid="chat-designer">
      <div className="border-b px-3 py-2">
        <h3 className="text-sm font-semibold">AI Designer</h3>
        <p className="text-[11px] text-muted-foreground">
          Describe what you want. The AI edits the graph for you.
        </p>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-2 text-sm">
        {history.length === 0 && (
          <div className="rounded border border-dashed p-2 text-[11px] text-muted-foreground">
            Try: &ldquo;Build a research team: a searcher that uses web search, a
            fact-checker that reviews findings, and a writer that drafts the
            final summary.&rdquo;
          </div>
        )}
        {history.map((t, i) => (
          <div
            key={i}
            className={`rounded-md px-2 py-1.5 ${
              t.role === 'user'
                ? 'bg-primary/10 text-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <span className="text-[10px] font-semibold uppercase">{t.role}</span>
            <div className="text-xs whitespace-pre-wrap">{t.content}</div>
          </div>
        ))}
        {loading && (
          <div className="rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">
            Designing…
          </div>
        )}
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
            {error}
          </div>
        )}
      </div>
      <div className="flex gap-2 border-t p-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={2}
          placeholder="Describe your agent team…"
          className="flex-1 rounded border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          data-testid="chat-designer-input"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              send()
            }
          }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="self-stretch rounded bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
          data-testid="chat-designer-send"
        >
          Send
        </button>
      </div>
    </div>
  )
}
