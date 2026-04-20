'use client'

import { useRef, useState } from 'react'
import type { ExecutorEvent } from '@/lib/agentTeams/executor'

export interface RunPanelProps {
  teamId: string
  onRunningChange?: (running: boolean) => void
}

export function RunPanel({ teamId, onRunningChange }: RunPanelProps) {
  const [input, setInput] = useState('Summarize recent news about AI agents.')
  const [events, setEvents] = useState<ExecutorEvent[]>([])
  const [finalOutput, setFinalOutput] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  async function run() {
    if (running) return
    setEvents([])
    setFinalOutput(null)
    setError(null)
    setRunning(true)
    onRunningChange?.(true)

    const controller = new AbortController()
    controllerRef.current = controller

    try {
      const res = await fetch(`/api/agent-teams/${teamId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `Run failed (${res.status})`)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const frames = buf.split('\n\n')
        buf = frames.pop() ?? ''
        for (const frame of frames) {
          const line = frame.trim()
          if (!line.startsWith('data: ')) continue
          const payload = line.slice('data: '.length)
          if (payload === '[DONE]') continue
          try {
            const ev = JSON.parse(payload) as ExecutorEvent
            setEvents((prev) => [...prev, ev])
            if (ev.type === 'final') setFinalOutput(ev.output)
            if (ev.type === 'error') setError(ev.message)
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'Run failed')
      }
    } finally {
      setRunning(false)
      onRunningChange?.(false)
    }
  }

  function cancel() {
    controllerRef.current?.abort()
  }

  return (
    <div className="flex h-full w-full flex-col" data-testid="run-panel">
      <div className="border-b px-3 py-2">
        <h3 className="text-sm font-semibold">Run</h3>
        <p className="text-[11px] text-muted-foreground">
          Send a test input through your team.
        </p>
      </div>
      <div className="flex gap-2 border-b p-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={2}
          className="flex-1 rounded border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="Test input…"
          data-testid="run-input"
        />
        {running ? (
          <button
            onClick={cancel}
            className="self-stretch rounded border border-destructive px-3 text-xs font-medium text-destructive"
          >
            Cancel
          </button>
        ) : (
          <button
            onClick={run}
            disabled={!input.trim()}
            className="self-stretch rounded bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
            data-testid="run-start"
          >
            Run
          </button>
        )}
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto px-3 py-2 text-xs" data-testid="run-log">
        {events.map((ev, i) => (
          <EventRow key={i} ev={ev} />
        ))}
        {error && (
          <div className="rounded border border-destructive/50 bg-destructive/10 px-2 py-1 text-destructive">
            {error}
          </div>
        )}
        {finalOutput !== null && (
          <div className="mt-2 rounded border border-primary/50 bg-primary/5 p-2" data-testid="run-final">
            <div className="mb-1 text-[10px] font-semibold uppercase text-primary">
              Final Output
            </div>
            <div className="whitespace-pre-wrap text-sm text-foreground">{finalOutput}</div>
          </div>
        )}
      </div>
    </div>
  )
}

function EventRow({ ev }: { ev: ExecutorEvent }) {
  const label = formatEvent(ev)
  const tone = toneFor(ev)
  return (
    <div className={`rounded px-2 py-1 ${tone}`}>
      <span className="mr-1 font-mono text-[10px] uppercase">{ev.type}</span>
      {label}
    </div>
  )
}

function formatEvent(ev: ExecutorEvent): string {
  switch (ev.type) {
    case 'run_started':
      return `Run started for ${ev.teamId}`
    case 'node_started':
      return `${ev.kind}: ${ev.label}`
    case 'node_completed':
      return `completed: ${ev.outputPreview}`
    case 'node_skipped':
      return `skipped: ${ev.reason}`
    case 'node_failed':
      return `failed: ${ev.message}`
    case 'guardrail_tripped':
      return `guardrail blocked: ${ev.reason}`
    case 'tool_call':
      return `tool ${ev.tool}`
    case 'token':
      return ev.content
    case 'final':
      return 'Run complete'
    case 'error':
      return ev.message
  }
}

function toneFor(ev: ExecutorEvent): string {
  switch (ev.type) {
    case 'node_completed':
    case 'final':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
    case 'node_failed':
    case 'error':
    case 'guardrail_tripped':
      return 'bg-destructive/10 text-destructive'
    case 'node_skipped':
      return 'bg-muted text-muted-foreground'
    default:
      return 'bg-card text-foreground'
  }
}
