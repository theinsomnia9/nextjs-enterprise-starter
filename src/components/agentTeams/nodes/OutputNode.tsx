'use client'

import { memo } from 'react'
import { NodeProps } from 'reactflow'
import type { OutputNodeData } from '@/lib/agentTeams/types'
import { BaseNode } from './BaseNode'

function OutputNode({ data, selected }: NodeProps<OutputNodeData>) {
  return (
    <BaseNode
      label={data.label}
      subLabel={`format: ${data.format}`}
      accent="#0ea5e9"
      icon="📤"
      selected={selected}
      showSource={false}
      testId="node-output"
    />
  )
}

export default memo(OutputNode)
