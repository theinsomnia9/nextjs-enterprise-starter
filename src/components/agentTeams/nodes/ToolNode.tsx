'use client'

import { memo } from 'react'
import { NodeProps } from 'reactflow'
import type { ToolNodeData } from '@/lib/agentTeams/types'
import { BaseNode } from './BaseNode'

function ToolNode({ data, selected }: NodeProps<ToolNodeData>) {
  return (
    <BaseNode
      label={data.label}
      subLabel={data.toolName}
      accent="#f59e0b"
      icon="🔧"
      selected={selected}
      testId="node-tool"
    />
  )
}

export default memo(ToolNode)
