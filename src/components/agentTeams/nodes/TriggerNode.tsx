'use client'

import { memo } from 'react'
import { NodeProps } from 'reactflow'
import type { TriggerNodeData } from '@/lib/agentTeams/types'
import { BaseNode } from './BaseNode'

function TriggerNode({ data, selected }: NodeProps<TriggerNodeData>) {
  return (
    <BaseNode
      label={data.label}
      subLabel={data.description}
      accent="#10b981"
      icon="→"
      selected={selected}
      showTarget={false}
      testId="node-trigger"
    />
  )
}

export default memo(TriggerNode)
