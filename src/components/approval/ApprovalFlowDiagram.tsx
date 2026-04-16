'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { Node as RFNode, Edge as RFEdge, NodeMouseHandler } from 'reactflow'
import { Background, Controls, MiniMap } from 'reactflow'
import 'reactflow/dist/style.css'
import { createYjsRoom, destroyYjsRoom, type YjsRoom } from '@/lib/approvals/yjsClient'
import type { QueueRequest } from './QueueDashboard'
import { cn } from '@/lib/utils'

const ReactFlow = dynamic(() => import('reactflow').then((m) => m.default), { ssr: false })

type NodeId = 'submit' | 'review' | 'decision'

interface NodeDetail {
  id: NodeId
  label: string
  description: string
  details: Array<{ key: string; value: string }>
}

interface ApprovalFlowDiagramProps {
  request: QueueRequest
  roomId?: string
}

const NODE_STATUS_MAP: Record<string, NodeId[]> = {
  PENDING: ['submit'],
  REVIEWING: ['submit', 'review'],
  APPROVED: ['submit', 'review', 'decision'],
  REJECTED: ['submit', 'review', 'decision'],
}

function getNodeStyle(nodeId: NodeId, requestStatus: string, selected: boolean) {
  const activeNodes = NODE_STATUS_MAP[requestStatus] ?? []
  const isActive = activeNodes.includes(nodeId)
  const isCurrentStep = activeNodes[activeNodes.length - 1] === nodeId

  let background = '#374151'
  if (nodeId === 'submit') background = '#6366f1'
  if (nodeId === 'review') background = isActive ? '#f59e0b' : '#374151'
  if (nodeId === 'decision') {
    if (requestStatus === 'APPROVED') background = '#22c55e'
    else if (requestStatus === 'REJECTED') background = '#ef4444'
    else background = isActive ? '#6b7280' : '#374151'
  }

  return {
    background,
    border: selected
      ? '2px solid #fff'
      : isCurrentStep
        ? '2px solid rgba(255,255,255,0.5)'
        : '2px solid transparent',
    borderRadius: 12,
    width: 160,
    padding: '0px',
    cursor: 'pointer',
    boxShadow: selected
      ? '0 0 0 3px rgba(255,255,255,0.3)'
      : isCurrentStep
        ? '0 0 12px rgba(255,255,255,0.15)'
        : 'none',
    opacity: isActive ? 1 : 0.45,
  }
}

function buildFlowData(
  request: QueueRequest,
  selectedNodeId: NodeId | null
): { nodes: RFNode[]; edges: RFEdge[] } {
  const nodes: RFNode[] = [
    {
      id: 'submit',
      type: 'default',
      position: { x: 60, y: 180 },
      data: {
        label: (
          <div className="flex flex-col items-center gap-1 px-3 py-3">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/70">
              Submitted
            </span>
            <span className="text-sm font-bold text-white">Submit</span>
          </div>
        ),
      },
      style: getNodeStyle('submit', request.status, selectedNodeId === 'submit'),
    },
    {
      id: 'review',
      type: 'default',
      position: { x: 300, y: 180 },
      data: {
        label: (
          <div className="flex flex-col items-center gap-1 px-3 py-3">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/70">
              In Review
            </span>
            <span className="text-sm font-bold text-white">Review</span>
          </div>
        ),
      },
      style: getNodeStyle('review', request.status, selectedNodeId === 'review'),
    },
    {
      id: 'decision',
      type: 'default',
      position: { x: 540, y: 180 },
      data: {
        label: (
          <div className="flex flex-col items-center gap-1 px-3 py-3">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/70">
              Outcome
            </span>
            <span className="text-sm font-bold text-white">
              {request.status === 'APPROVED'
                ? 'Approved'
                : request.status === 'REJECTED'
                  ? 'Rejected'
                  : 'Decision'}
            </span>
          </div>
        ),
      },
      style: getNodeStyle('decision', request.status, selectedNodeId === 'decision'),
    },
  ]

  const edges: RFEdge[] = [
    {
      id: 'e-submit-review',
      source: 'submit',
      target: 'review',
      animated: request.status === 'REVIEWING',
      style: { stroke: '#f59e0b', strokeWidth: 2 },
    },
    {
      id: 'e-review-decision',
      source: 'review',
      target: 'decision',
      animated: request.status === 'APPROVED' || request.status === 'REJECTED',
      style: {
        stroke:
          request.status === 'APPROVED'
            ? '#22c55e'
            : request.status === 'REJECTED'
              ? '#ef4444'
              : '#6b7280',
        strokeWidth: 2,
      },
    },
  ]

  return { nodes, edges }
}

function buildNodeDetail(nodeId: NodeId, request: QueueRequest): NodeDetail {
  switch (nodeId) {
    case 'submit':
      return {
        id: 'submit',
        label: 'Submission',
        description: 'This step captures who submitted the request and when.',
        details: [
          { key: 'Title', value: request.title },
          { key: 'Submitted by', value: request.requester.name ?? request.requester.email ?? '—' },
          { key: 'Category', value: request.category },
          { key: 'Priority Score', value: String(Math.round(request.priorityScore)) },
          { key: 'Submitted at', value: new Date(request.submittedAt).toLocaleString() },
        ],
      }
    case 'review':
      return {
        id: 'review',
        label: 'Review',
        description: 'A reviewer locks and examines this request before making a decision.',
        details: [
          {
            key: 'Reviewer',
            value: request.assignee
              ? (request.assignee.name ?? request.assignee.email ?? '—')
              : 'Unassigned',
          },
          {
            key: 'Locked at',
            value: request.lockedAt ? new Date(request.lockedAt).toLocaleString() : '—',
          },
          {
            key: 'Lock expires',
            value: request.lockExpiresAt ? new Date(request.lockExpiresAt).toLocaleString() : '—',
          },
          { key: 'Current status', value: request.status },
        ],
      }
    case 'decision':
      return {
        id: 'decision',
        label: 'Decision',
        description: 'The final outcome of the approval process.',
        details: [
          {
            key: 'Outcome',
            value:
              request.status === 'APPROVED'
                ? 'Approved ✓'
                : request.status === 'REJECTED'
                  ? 'Rejected ✗'
                  : 'Pending decision',
          },
          {
            key: 'Decided by',
            value: request.assignee
              ? (request.assignee.name ?? request.assignee.email ?? '—')
              : '—',
          },
        ],
      }
  }
}

export function ApprovalFlowDiagram({ request, roomId }: ApprovalFlowDiagramProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<NodeId | null>(null)
  const yjsRoomRef = useRef<YjsRoom | null>(null)

  const { nodes, edges } = buildFlowData(request, selectedNodeId)

  useEffect(() => {
    const effectiveRoomId = roomId ?? `approval-${request.id}`
    try {
      const room = createYjsRoom(effectiveRoomId)
      yjsRoomRef.current = room
      room.awareness.setLocalStateField('user', {
        requestId: request.id,
        viewedAt: new Date().toISOString(),
      })
    } catch {
      /* Yjs unavailable in test/static env — gracefully skip */
    }
    return () => {
      if (yjsRoomRef.current) {
        destroyYjsRoom(yjsRoomRef.current)
        yjsRoomRef.current = null
      }
    }
  }, [request.id, roomId])

  const handleNodeClick = useCallback<NodeMouseHandler>((_event, node) => {
    setSelectedNodeId((prev) => (prev === node.id ? null : (node.id as NodeId)))
  }, [])

  const nodeDetail = selectedNodeId ? buildNodeDetail(selectedNodeId, request) : null

  return (
    <div data-testid="approval-flow-diagram" className="flex h-full w-full flex-col gap-4">
      <div className="relative flex-1 overflow-hidden rounded-xl border border-border bg-[#0f1117]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          attributionPosition="bottom-right"
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
        >
          <Background variant={'dots' as never} gap={20} size={1} color="#1e293b" />
          <Controls showInteractive={false} className="!border-border !bg-card" />
          <MiniMap
            className="!border-border !bg-card"
            nodeColor={(n) => {
              const styles = n.style as { background?: string } | undefined
              return styles?.background ?? '#374151'
            }}
          />
        </ReactFlow>

        {selectedNodeId && nodeDetail && (
          <div
            data-testid="node-detail-panel"
            className={cn(
              'absolute right-4 top-4 z-10 w-72 rounded-xl border border-border bg-card/95 p-5 shadow-2xl backdrop-blur-sm',
              'duration-200 animate-in fade-in slide-in-from-right-4'
            )}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Node detail
                </p>
                <h3 className="mt-0.5 text-base font-bold">{nodeDetail.label}</h3>
              </div>
              <button
                data-testid="detail-panel-close"
                onClick={() => setSelectedNodeId(null)}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Close detail panel"
              >
                ✕
              </button>
            </div>

            <p className="mb-3 text-xs text-muted-foreground">{nodeDetail.description}</p>

            <dl className="flex flex-col gap-2">
              {nodeDetail.details.map(({ key, value }) => (
                <div key={key} className="flex flex-col gap-0.5">
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {key}
                  </dt>
                  <dd className="text-sm font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" />
          Submitted
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
          In Review
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
          Approved
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
          Rejected
        </div>
        <span className="ml-auto italic">Click a node for details</span>
      </div>
    </div>
  )
}
