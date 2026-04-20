'use client'

import { useMemo } from 'react'
import type {
  AgentNodeData,
  AnyNodeData,
  GuardrailNodeData,
  OutputNodeData,
  TeamNode,
  ToolNodeData,
  TriggerNodeData,
} from '@/lib/agentTeams/types'
import { listTools } from '@/lib/agentTeams/toolRegistry'

export interface PropertyPanelProps {
  node: TeamNode | null
  onChange: (nodeId: string, patch: Partial<AnyNodeData>) => void
  onDelete: (nodeId: string) => void
}

export function PropertyPanel({ node, onChange, onDelete }: PropertyPanelProps) {
  if (!node) {
    return (
      <aside className="flex w-80 shrink-0 flex-col border-l bg-card p-4 text-sm text-muted-foreground">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Properties</h2>
        Select a node to edit its settings.
      </aside>
    )
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-l bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {node.type}
          </div>
          <h2 className="text-sm font-semibold">{node.data.label}</h2>
        </div>
        <button
          onClick={() => onDelete(node.id)}
          className="rounded border border-destructive/30 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
          data-testid="property-delete"
        >
          Delete
        </button>
      </div>

      {renderForm(node, onChange)}
    </aside>
  )
}

function renderForm(
  node: TeamNode,
  onChange: (nodeId: string, patch: Partial<AnyNodeData>) => void
) {
  const patch = (p: Partial<AnyNodeData>) => onChange(node.id, p)

  switch (node.data.kind) {
    case 'trigger':
      return <TriggerForm data={node.data} onPatch={patch} />
    case 'agent':
      return <AgentForm data={node.data} onPatch={patch} />
    case 'tool':
      return <ToolForm data={node.data} onPatch={patch} />
    case 'guardrail':
      return <GuardrailForm data={node.data} onPatch={patch} />
    case 'output':
      return <OutputForm data={node.data} onPatch={patch} />
  }
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </label>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  testId,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  testId?: string
}) {
  return (
    <input
      type="text"
      className="rounded border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary/40"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      data-testid={testId}
    />
  )
}

function TextArea({
  value,
  onChange,
  rows = 4,
  testId,
}: {
  value: string
  onChange: (v: string) => void
  rows?: number
  testId?: string
}) {
  return (
    <textarea
      className="rounded border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary/40"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      data-testid={testId}
    />
  )
}

function NumberInput({
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
}) {
  return (
    <input
      type="number"
      className="rounded border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary/40"
      value={value}
      step={step}
      min={min}
      max={max}
      onChange={(e) => {
        const parsed = Number(e.target.value)
        if (!Number.isNaN(parsed)) onChange(parsed)
      }}
    />
  )
}

function Select<T extends string>({
  value,
  options,
  onChange,
  testId,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  testId?: string
}) {
  return (
    <select
      className="rounded border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary/40"
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      data-testid={testId}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function TriggerForm({
  data,
  onPatch,
}: {
  data: TriggerNodeData
  onPatch: (p: Partial<TriggerNodeData>) => void
}) {
  return (
    <>
      <Field label="Label">
        <TextInput
          value={data.label}
          onChange={(v) => onPatch({ label: v })}
          testId="field-label"
        />
      </Field>
      <Field label="Description">
        <TextArea value={data.description ?? ''} onChange={(v) => onPatch({ description: v })} />
      </Field>
    </>
  )
}

function AgentForm({
  data,
  onPatch,
}: {
  data: AgentNodeData
  onPatch: (p: Partial<AgentNodeData>) => void
}) {
  const tools = listTools()
  const toggleTool = (name: string) => {
    const next = data.toolNames.includes(name)
      ? data.toolNames.filter((t) => t !== name)
      : [...data.toolNames, name]
    onPatch({ toolNames: next })
  }
  return (
    <>
      <Field label="Label">
        <TextInput
          value={data.label}
          onChange={(v) => onPatch({ label: v })}
          testId="field-label"
        />
      </Field>
      <Field label="Role" hint="Short human-readable role, e.g. 'Researcher'.">
        <TextInput value={data.role} onChange={(v) => onPatch({ role: v })} testId="field-role" />
      </Field>
      <Field label="System prompt" hint="Instructions that define this agent's behavior.">
        <TextArea
          value={data.systemPrompt}
          onChange={(v) => onPatch({ systemPrompt: v })}
          rows={6}
          testId="field-prompt"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Model">
          <Select
            value={data.model}
            options={[
              { value: 'gpt-4o-mini', label: 'gpt-4o-mini (fast/cheap)' },
              { value: 'gpt-4o', label: 'gpt-4o (capable)' },
              { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini' },
            ]}
            onChange={(v) => onPatch({ model: v })}
          />
        </Field>
        <Field label="Temperature">
          <NumberInput
            value={data.temperature}
            step={0.1}
            min={0}
            max={2}
            onChange={(v) => onPatch({ temperature: v })}
          />
        </Field>
      </div>
      <Field label="Max turns" hint="Cap on tool/reasoning iterations.">
        <NumberInput
          value={data.maxTurns}
          min={1}
          max={20}
          onChange={(v) => onPatch({ maxTurns: v })}
        />
      </Field>
      <Field label="Tools">
        <div className="flex flex-col gap-1">
          {tools.map((t) => (
            <label key={t.name} className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                checked={data.toolNames.includes(t.name)}
                onChange={() => toggleTool(t.name)}
                data-testid={`tool-toggle-${t.name}`}
              />
              <span>
                <span className="font-medium">{t.label}</span>
                {t.placeholder && (
                  <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                    placeholder
                  </span>
                )}
                <div className="text-[10px] text-muted-foreground">{t.description}</div>
              </span>
            </label>
          ))}
        </div>
      </Field>
    </>
  )
}

function ToolForm({
  data,
  onPatch,
}: {
  data: ToolNodeData
  onPatch: (p: Partial<ToolNodeData>) => void
}) {
  const tools = listTools()
  return (
    <>
      <Field label="Label">
        <TextInput value={data.label} onChange={(v) => onPatch({ label: v })} />
      </Field>
      <Field label="Tool">
        <Select
          value={data.toolName}
          options={tools.map((t) => ({ value: t.name, label: t.label }))}
          onChange={(v) => onPatch({ toolName: v })}
        />
      </Field>
    </>
  )
}

function GuardrailForm({
  data,
  onPatch,
}: {
  data: GuardrailNodeData
  onPatch: (p: Partial<GuardrailNodeData>) => void
}) {
  const blocklistText = useMemo(() => (data.blocklist ?? []).join(', '), [data.blocklist])
  return (
    <>
      <Field label="Label">
        <TextInput value={data.label} onChange={(v) => onPatch({ label: v })} />
      </Field>
      <Field label="Type">
        <Select
          value={data.guardrailKind}
          options={[
            { value: 'blocklist', label: 'Blocklist (term filter)' },
            { value: 'length', label: 'Length cap' },
            { value: 'relevance', label: 'Relevance (topic keyword)' },
          ]}
          onChange={(v) => onPatch({ guardrailKind: v })}
        />
      </Field>
      {data.guardrailKind === 'blocklist' && (
        <Field label="Blocked terms" hint="Comma-separated.">
          <TextArea
            value={blocklistText}
            onChange={(v) =>
              onPatch({
                blocklist: v
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </Field>
      )}
      {data.guardrailKind === 'length' && (
        <Field label="Max length">
          <NumberInput
            value={data.maxLength ?? 2000}
            min={1}
            max={100000}
            onChange={(v) => onPatch({ maxLength: v })}
          />
        </Field>
      )}
      {data.guardrailKind === 'relevance' && (
        <Field label="Topic keyword" hint="Input must mention this term to pass.">
          <TextInput value={data.topic ?? ''} onChange={(v) => onPatch({ topic: v })} />
        </Field>
      )}
    </>
  )
}

function OutputForm({
  data,
  onPatch,
}: {
  data: OutputNodeData
  onPatch: (p: Partial<OutputNodeData>) => void
}) {
  return (
    <>
      <Field label="Label">
        <TextInput value={data.label} onChange={(v) => onPatch({ label: v })} />
      </Field>
      <Field label="Format">
        <Select
          value={data.format}
          options={[
            { value: 'markdown', label: 'Markdown' },
            { value: 'text', label: 'Plain text' },
            { value: 'json', label: 'JSON' },
          ]}
          onChange={(v) => onPatch({ format: v })}
        />
      </Field>
    </>
  )
}
