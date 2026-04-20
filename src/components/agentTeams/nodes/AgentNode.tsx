'use client'

import { memo } from 'react'
import { NodeProps } from 'reactflow'
import type { AgentNodeData } from '@/lib/agentTeams/types'
import { BaseNode } from './BaseNode'

function AgentNode({ data, selected }: NodeProps<AgentNodeData>) {
  return (
    <BaseNode
      label={data.label}
      subLabel={`${data.role} · ${data.model}`}
      accent="#6366f1"
      icon="🤖"
      selected={selected}
      testId="node-agent"
    >
      {data.toolNames?.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {data.toolNames.map((t) => (
            <span
              key={t}
              className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </BaseNode>
  )
}

export default memo(AgentNode)
