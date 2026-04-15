'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export type CustomNodeData = {
  label: string
  description?: string
}

function CustomNode({ data, isConnectable }: NodeProps<CustomNodeData>) {
  return (
    <div className="custom-node px-4 py-3 rounded-lg border-2 border-primary bg-card shadow-lg min-w-[200px]">
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="w-3 h-3 !bg-primary"
      />

      <div className="node-content">
        <div className="font-semibold text-sm mb-1">{data.label}</div>
        {data.description && (
          <div className="text-xs text-muted-foreground">{data.description}</div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="w-3 h-3 !bg-primary"
      />
    </div>
  )
}

export default memo(CustomNode)
