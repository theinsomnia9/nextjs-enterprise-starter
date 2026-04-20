'use client'

import { listNodeSpecs } from '@/lib/agentTeams/nodeRegistry'
import type { NodeKind } from '@/lib/agentTeams/types'

export interface NodePaletteProps {
  onAdd: (kind: NodeKind) => void
}

export function NodePalette({ onAdd }: NodePaletteProps) {
  return (
    <aside className="flex w-64 shrink-0 flex-col gap-2 border-r bg-card p-3">
      <div>
        <h2 className="text-sm font-semibold">Node Palette</h2>
        <p className="text-xs text-muted-foreground">Click a node to add it to the canvas.</p>
      </div>
      <div className="flex flex-col gap-2">
        {listNodeSpecs().map((spec) => (
          <button
            key={spec.kind}
            onClick={() => onAdd(spec.kind)}
            data-testid={`palette-add-${spec.kind}`}
            className="flex w-full flex-col items-start gap-0.5 rounded-md border bg-background px-3 py-2 text-left transition hover:border-primary hover:bg-primary/5"
            style={{ borderLeftColor: spec.color, borderLeftWidth: 5 }}
          >
            <span className="text-sm font-medium">{spec.label}</span>
            <span className="text-[11px] text-muted-foreground">{spec.description}</span>
          </button>
        ))}
      </div>
    </aside>
  )
}
