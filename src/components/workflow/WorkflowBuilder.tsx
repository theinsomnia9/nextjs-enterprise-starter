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
    setNodes((nds: Node<CustomNodeData>[]) =>
      nds.filter((node: Node<CustomNodeData>) => !node.selected)
    )
    setEdges((eds: Edge[]) =>
      eds.filter((edge: Edge) => {
        const sourceNode = nodes.find((n: Node<CustomNodeData>) => n.id === edge.source)
        const targetNode = nodes.find((n: Node<CustomNodeData>) => n.id === edge.target)
        return !sourceNode?.selected && !targetNode?.selected
      })
    )
  }, [setNodes, setEdges, nodes])

  return (
    <div className="flex h-screen w-full flex-col">
      <div className="flex gap-2 border-b bg-card p-4">
        <button
          onClick={addNode}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Add Node
        </button>
        <button
          onClick={deleteSelectedNodes}
          className="rounded-md bg-destructive px-4 py-2 text-destructive-foreground transition-colors hover:bg-destructive/90"
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
          <MiniMap nodeStrokeWidth={3} className="border border-border bg-card" />
          <Controls className="border border-border bg-card" />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
      </div>
    </div>
  )
}
