'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export type CustomNodeData = {
  label: string
  description?: string
}

function CustomNode({ data, isConnectable }: NodeProps<CustomNodeData>) {
  return (
    <div className="custom-node min-w-[200px] rounded-lg border-2 border-primary bg-card px-4 py-3 shadow-lg">
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="h-3 w-3 !bg-primary"
      />

      <div className="node-content">
        <div className="mb-1 text-sm font-semibold">{data.label}</div>
        {data.description && (
          <div className="text-xs text-muted-foreground">{data.description}</div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="h-3 w-3 !bg-primary"
      />
    </div>
  )
}

export default memo(CustomNode)
