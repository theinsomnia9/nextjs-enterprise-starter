'use client'

import { useCallback, useState } from 'react'
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
} from 'reactflow'
import 'reactflow/dist/style.css'

import CustomNode from './nodes/CustomNode'
import { CustomNodeData } from './nodes/CustomNode'

const nodeTypes = {
  custom: CustomNode,
}

const initialNodes: Node<CustomNodeData>[] = [
  {
    id: '1',
    type: 'custom',
    position: { x: 250, y: 50 },
    data: { label: 'Start Node', description: 'Beginning of workflow' },
  },
  {
    id: '2',
    type: 'custom',
    position: { x: 250, y: 200 },
    data: { label: 'Process Node', description: 'Main processing step' },
  },
  {
    id: '3',
    type: 'custom',
    position: { x: 250, y: 350 },
    data: { label: 'End Node', description: 'Workflow completion' },
  },
]

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true },
  { id: 'e2-3', source: '2', target: '3' },
]

export default function WorkflowBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [nodeId, setNodeId] = useState(4)

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds: Edge[]) => addEdge(params, eds)),
    [setEdges]
  )

  const addNode = useCallback(() => {
    const newNode: Node<CustomNodeData> = {
      id: `${nodeId}`,
      type: 'custom',
      position: {
        x: Math.random() * 400 + 50,
        y: Math.random() * 400 + 50,
      },
      data: {
        label: `Node ${nodeId}`,
        description: 'New workflow step',
      },
    }
    setNodes((nds: Node<CustomNodeData>[]) => [...nds, newNode])
    setNodeId((id) => id + 1)
  }, [nodeId, setNodes])

  const deleteSelectedNodes = useCallback(() => {
    setNodes((nds: Node<CustomNodeData>[]) => nds.filter((node: Node<CustomNodeData>) => !node.selected))
    setEdges((eds: Edge[]) =>
      eds.filter((edge: Edge) => {
        const sourceNode = nodes.find((n: Node<CustomNodeData>) => n.id === edge.source)
        const targetNode = nodes.find((n: Node<CustomNodeData>) => n.id === edge.target)
        return !sourceNode?.selected && !targetNode?.selected
      })
    )
  }, [setNodes, setEdges, nodes])

  return (
    <div className="w-full h-screen flex flex-col">
      <div className="bg-card border-b p-4 flex gap-2">
        <button
          onClick={addNode}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Add Node
        </button>
        <button
          onClick={deleteSelectedNodes}
          className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors"
        >
          Delete Selected
        </button>
      </div>
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="bg-background"
        >
          <MiniMap
            nodeStrokeWidth={3}
            className="bg-card border border-border"
          />
          <Controls className="bg-card border border-border" />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
      </div>
    </div>
  )
}
