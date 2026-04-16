'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from 'reactflow'
import 'reactflow/dist/style.css'
import PusherJS from 'pusher-js'
import { createYjsRoom, destroyYjsRoom, type YjsRoom } from '@/lib/approvals/yjsClient'
import { APPROVAL_CHANNEL } from '@/lib/approvals/pusherServer'

export type StatusCounts = {
  PENDING: number
  REVIEWING: number
  APPROVED: number
  REJECTED: number
}

interface ApprovalPipelineProps {
  initialCounts: StatusCounts
  onNodeClick?: NodeMouseHandler
}

const STAGE_LABELS: (keyof StatusCounts)[] = ['PENDING', 'REVIEWING', 'APPROVED', 'REJECTED']

const STAGE_X: Record<keyof StatusCounts, number> = {
  PENDING: 50,
  REVIEWING: 250,
  APPROVED: 450,
  REJECTED: 650,
}

const STAGE_COLORS: Record<keyof StatusCounts, string> = {
  PENDING: '#6366f1',
  REVIEWING: '#f59e0b',
  APPROVED: '#22c55e',
  REJECTED: '#ef4444',
}

function buildNodes(counts: StatusCounts): Node[] {
  return STAGE_LABELS.map((label) => ({
    id: label,
    type: 'default',
    position: { x: STAGE_X[label], y: 150 },
    data: {
      label: (
        <div className="flex flex-col items-center gap-1 px-3 py-2">
          <span className="text-xs font-semibold text-white">{label}</span>
          <span className="text-xl font-bold text-white">{counts[label]}</span>
        </div>
      ),
    },
    style: {
      background: STAGE_COLORS[label],
      border: 'none',
      borderRadius: 8,
      width: 140,
    },
  }))
}

const INITIAL_EDGES: Edge[] = [
  { id: 'e1', source: 'PENDING', target: 'REVIEWING', animated: true },
  { id: 'e2', source: 'REVIEWING', target: 'APPROVED' },
  { id: 'e3', source: 'REVIEWING', target: 'REJECTED' },
]

export function ApprovalPipeline({ initialCounts, onNodeClick }: ApprovalPipelineProps) {
  const [counts, setCounts] = useState<StatusCounts>(initialCounts)
  const [nodes, setNodes, onNodesChange] = useNodesState(buildNodes(initialCounts))
  const [edges, , onEdgesChange] = useEdgesState(INITIAL_EDGES)
  const yjsRoomRef = useRef<YjsRoom | null>(null)

  useEffect(() => {
    setNodes(buildNodes(counts))
  }, [counts, setNodes])

  useEffect(() => {
    const room = createYjsRoom('approval-pipeline')
    yjsRoomRef.current = room

    const pusher = new PusherJS(process.env.NEXT_PUBLIC_PUSHER_APP_KEY!, {
      wsHost: process.env.NEXT_PUBLIC_PUSHER_HOST ?? 'localhost',
      wsPort: Number(process.env.NEXT_PUBLIC_PUSHER_PORT ?? '6001'),
      forceTLS: false,
      enabledTransports: ['ws'],
      authEndpoint: '/api/pusher/auth',
      cluster: 'self-hosted',
      disableStats: true,
    })

    const channel = pusher.subscribe(APPROVAL_CHANNEL)

    const refresh = () => {
      fetch('/api/approvals/queue')
        .then((r) => r.json())
        .then((data: { requests: Array<{ status: keyof StatusCounts }> }) => {
          const next: StatusCounts = { PENDING: 0, REVIEWING: 0, APPROVED: 0, REJECTED: 0 }
          data.requests.forEach((req) => {
            if (req.status in next) next[req.status]++
          })
          setCounts(next)
        })
        .catch(() => {})
    }

    channel.bind('request:submitted', refresh)
    channel.bind('request:locked', refresh)
    channel.bind('request:unlocked', refresh)
    channel.bind('request:approved', refresh)
    channel.bind('request:rejected', refresh)

    return () => {
      channel.unbind_all()
      pusher.unsubscribe(APPROVAL_CHANNEL)
      pusher.disconnect()
      if (yjsRoomRef.current) {
        destroyYjsRoom(yjsRoomRef.current)
        yjsRoomRef.current = null
      }
    }
  }, [])

  const handleNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      onNodeClick?.(event, node)
    },
    [onNodeClick]
  )

  return (
    <div data-testid="approval-pipeline" className="flex w-full flex-col gap-2">
      <div className="flex gap-3">
        {STAGE_LABELS.map((label) => (
          <div
            key={label}
            className="flex flex-1 flex-col items-center rounded-md px-3 py-2"
            style={{ background: STAGE_COLORS[label] }}
          >
            <span className="text-xs font-semibold text-white">{label}</span>
            <span className="text-xl font-bold text-white">{counts[label]}</span>
          </div>
        ))}
      </div>
      <div className="h-[340px] w-full rounded-lg border border-border bg-background">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          fitView
          attributionPosition="bottom-right"
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  )
}
