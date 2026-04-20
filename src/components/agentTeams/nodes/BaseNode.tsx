'use client'

import { ReactNode } from 'react'
import { Handle, Position } from 'reactflow'

export interface BaseNodeProps {
  label: string
  subLabel?: string
  icon?: ReactNode
  accent: string
  children?: ReactNode
  selected?: boolean
  showTarget?: boolean
  showSource?: boolean
  testId?: string
}

export function BaseNode({
  label,
  subLabel,
  icon,
  accent,
  children,
  selected,
  showTarget = true,
  showSource = true,
  testId,
}: BaseNodeProps) {
  return (
    <div
      data-testid={testId}
      className={`min-w-[220px] rounded-lg border-2 bg-card px-3 py-2 shadow-md transition ${
        selected ? 'border-primary ring-2 ring-primary/40' : 'border-border'
      }`}
      style={{ borderLeftColor: accent, borderLeftWidth: 6 }}
    >
      {showTarget && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-3 !w-3"
          style={{ background: accent }}
        />
      )}
      <div className="flex items-start gap-2">
        {icon && <div className="mt-0.5 text-lg leading-none">{icon}</div>}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{label}</div>
          {subLabel && (
            <div className="truncate text-xs text-muted-foreground">{subLabel}</div>
          )}
          {children}
        </div>
      </div>
      {showSource && (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-3 !w-3"
          style={{ background: accent }}
        />
      )}
    </div>
  )
}
