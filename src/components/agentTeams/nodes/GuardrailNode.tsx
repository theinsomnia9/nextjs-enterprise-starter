'use client'

import { memo } from 'react'
import { NodeProps } from 'reactflow'
import type { GuardrailNodeData } from '@/lib/agentTeams/types'
import { BaseNode } from './BaseNode'

function GuardrailNode({ data, selected }: NodeProps<GuardrailNodeData>) {
  return (
    <BaseNode
      label={data.label}
      subLabel={`${data.guardrailKind} guardrail`}
      accent="#ef4444"
      icon="🛡"
      selected={selected}
      testId="node-guardrail"
    />
  )
}

export default memo(GuardrailNode)
