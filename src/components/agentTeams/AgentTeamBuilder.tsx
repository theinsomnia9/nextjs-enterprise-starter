'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  Edge,
  MiniMap,
  Node,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { nodeTypes } from './nodes'
import { NodePalette } from './NodePalette'
import { PropertyPanel } from './PropertyPanel'
import { ChatDesigner } from './ChatDesigner'
import { RunPanel } from './RunPanel'
import { NODE_REGISTRY } from '@/lib/agentTeams/nodeRegistry'
import type {
  AgentTeamDetail,
  AnyNodeData,
  NodeKind,
  TeamDefinition,
  TeamEdge,
  TeamNode as DomainNode,
} from '@/lib/agentTeams/types'
import { validateTeamDefinition } from '@/lib/agentTeams/validator'
import { updateTeam } from '@/lib/api/agentTeams'

type FlowNode = Node<AnyNodeData>

function toFlowNodes(def: TeamDefinition): FlowNode[] {
  return def.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data,
  }))
}

function toFlowEdges(def: TeamDefinition): Edge[] {
  return def.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: e.animated,
  }))
}

function toDomainDefinition(
  metadata: TeamDefinition['metadata'],
  nodes: FlowNode[],
  edges: Edge[]
): TeamDefinition {
  return {
    version: 1,
    metadata,
    nodes: nodes.map((n) => ({
      id: n.id,
      type: (n.type ?? n.data.kind) as NodeKind,
      position: n.position,
      data: n.data,
    })) as DomainNode[],
    edges: edges.map((e): TeamEdge => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: typeof e.label === 'string' ? e.label : undefined,
      animated: e.animated,
    })),
  }
}

export interface AgentTeamBuilderProps {
  team: AgentTeamDetail
}

export function AgentTeamBuilder({ team }: AgentTeamBuilderProps) {
  return (
    <ReactFlowProvider>
      <BuilderInner team={team} />
    </ReactFlowProvider>
  )
}

function BuilderInner({ team }: AgentTeamBuilderProps) {
  const [metadata, setMetadata] = useState<TeamDefinition['metadata']>(team.definition.metadata)
  const [nodes, setNodes, onNodesChange] = useNodesState<AnyNodeData>(
    toFlowNodes(team.definition)
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(toFlowEdges(team.definition))
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [dirty, setDirty] = useState(false)
  const [rightPanel, setRightPanel] = useState<'properties' | 'chat' | 'run'>('properties')
  const counterRef = useRef(0)

  const definition = useMemo(
    () => toDomainDefinition(metadata, nodes, edges),
    [metadata, nodes, edges]
  )

  const validation = useMemo(() => validateTeamDefinition(definition), [definition])

  useEffect(() => {
    // initial mount should not be dirty
    setDirty(false)
  }, [])

  const selectedNode: DomainNode | null = useMemo(() => {
    if (!selectedNodeId) return null
    const n = nodes.find((n) => n.id === selectedNodeId)
    if (!n) return null
    return {
      id: n.id,
      type: (n.type ?? n.data.kind) as NodeKind,
      position: n.position,
      data: n.data,
    } as DomainNode
  }, [nodes, selectedNodeId])

  const genNodeId = useCallback((kind: NodeKind) => {
    counterRef.current += 1
    const ts = Date.now().toString(36)
    return `${kind}-${ts}-${counterRef.current}`
  }, [])

  const addNode = useCallback(
    (kind: NodeKind) => {
      const spec = NODE_REGISTRY[kind]
      const id = genNodeId(kind)
      const newNode: FlowNode = {
        id,
        type: kind,
        position: {
          x: 280 + Math.random() * 200,
          y: 100 + Math.random() * 260,
        },
        data: spec.defaults() as AnyNodeData,
      }
      setNodes((prev) => [...prev, newNode])
      setSelectedNodeId(id)
      setDirty(true)
    },
    [genNodeId, setNodes]
  )

  const updateNodeData = useCallback(
    (nodeId: string, patch: Partial<AnyNodeData>) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...patch } as AnyNodeData } : n
        )
      )
      setDirty(true)
    },
    [setNodes]
  )

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((prev) => prev.filter((n) => n.id !== nodeId))
      setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId))
      if (selectedNodeId === nodeId) setSelectedNodeId(null)
      setDirty(true)
    },
    [selectedNodeId, setEdges, setNodes]
  )

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            id: `e-${params.source}-${params.target}-${Date.now().toString(36)}`,
            animated: true,
          },
          eds
        )
      )
      setDirty(true)
    },
    [setEdges]
  )

  const onProposal = useCallback(
    (next: TeamDefinition, _rationale: string) => {
      setMetadata(next.metadata)
      setNodes(toFlowNodes(next))
      setEdges(toFlowEdges(next))
      setDirty(true)
    },
    [setEdges, setNodes]
  )

  async function save() {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await updateTeam(team.id, {
        name: metadata.title,
        description: metadata.description,
        definition,
      })
      setLastSavedAt(new Date(res.updatedAt))
      setDirty(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full w-full flex-col" data-testid="agent-team-builder">
      <header className="flex items-center justify-between gap-2 border-b bg-card px-4 py-2">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/agent-teams" className="text-xs text-muted-foreground hover:underline">
            ← Teams
          </Link>
          <input
            value={metadata.title}
            onChange={(e) => {
              setMetadata((m) => ({ ...m, title: e.target.value }))
              setDirty(true)
            }}
            className="min-w-0 flex-1 bg-transparent text-base font-semibold outline-none"
            data-testid="team-title"
          />
          {validation.issues.length > 0 && (
            <span
              className={`rounded px-2 py-0.5 text-[10px] ${
                validation.ok
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                  : 'bg-destructive/10 text-destructive'
              }`}
              title={validation.issues.map((i) => i.message).join('\n')}
            >
              {validation.ok ? 'Warnings' : 'Errors'}: {validation.issues.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-[11px] text-amber-600">Unsaved changes</span>}
          {lastSavedAt && !dirty && (
            <span className="text-[11px] text-muted-foreground">
              Saved {lastSavedAt.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
            data-testid="team-save"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>
      {saveError && (
        <div className="border-b bg-destructive/10 px-4 py-1 text-xs text-destructive">
          {saveError}
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <NodePalette onAdd={addNode} />
        <div className="relative flex min-w-0 flex-1" data-testid="canvas-wrap">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={(changes) => {
              onEdgesChange(changes)
              if (changes.some((c) => c.type === 'remove' || c.type === 'add')) setDirty(true)
            }}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onSelectionChange={({ nodes: sel }) =>
              setSelectedNodeId(sel[0]?.id ?? null)
            }
            fitView
            className="agent-team-flow bg-background"
          >
            <MiniMap
              nodeStrokeWidth={3}
              className="border border-border"
              style={{ backgroundColor: 'hsl(var(--card))' }}
              maskColor="hsl(var(--muted) / 0.6)"
              nodeStrokeColor="hsl(var(--border))"
              nodeColor={(n) => NODE_REGISTRY[(n.type ?? 'agent') as NodeKind].color}
            />
            <Controls className="border border-border" />
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          </ReactFlow>
        </div>
        <div className="flex w-96 shrink-0 flex-col border-l bg-card">
          <div className="flex border-b" role="tablist">
            <TabButton
              active={rightPanel === 'properties'}
              onClick={() => setRightPanel('properties')}
              testId="tab-properties"
            >
              Properties
            </TabButton>
            <TabButton
              active={rightPanel === 'chat'}
              onClick={() => setRightPanel('chat')}
              testId="tab-chat"
            >
              AI Designer
            </TabButton>
            <TabButton
              active={rightPanel === 'run'}
              onClick={() => setRightPanel('run')}
              testId="tab-run"
            >
              Run
            </TabButton>
          </div>
          <div className="flex min-h-0 flex-1">
            {rightPanel === 'properties' && (
              <PropertyPanel
                node={selectedNode}
                onChange={updateNodeData}
                onDelete={deleteNode}
              />
            )}
            {rightPanel === 'chat' && (
              <ChatDesigner definition={definition} onProposal={onProposal} />
            )}
            {rightPanel === 'run' && <RunPanel teamId={team.id} />}
          </div>
        </div>
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
  testId,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  testId?: string
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      data-testid={testId}
      onClick={onClick}
      className={`flex-1 border-b-2 px-2 py-2 text-xs font-medium transition ${
        active
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}
