# Workflow Builder

Visual node-based workflow canvas built on [ReactFlow](https://reactflow.dev).

## Entry point

- Page: `src/app/builder/page.tsx` — route `/builder`
- Component: `src/components/workflow/WorkflowBuilder.tsx`
- Custom node: `src/components/workflow/nodes/CustomNode.tsx`

## What works today

- Drag-to-place nodes, connect via top/bottom handles
- Add/delete nodes, pan/zoom, minimap, fit-view controls
- Dark-mode styling via CSS variables (see `docs/features/theming.md`)

The initial graph is a three-node Start → Process → End demo. Nothing is persisted — the canvas state lives in React state only. The `Workflow`, `WorkflowNode`, `WorkflowExecution`, `WorkflowStep` Prisma models exist but are not yet wired to the UI; persisting and executing workflows is unbuilt.

## Tests

- Unit: `__tests__/unit/components/workflow/WorkflowBuilder.test.tsx`, `CustomNode.test.tsx`
- E2E: `__tests__/e2e/builder.spec.ts`

## Notable dependency

`reactflow@^11` is the canvas. Context7 ID: `/xyflow/xyflow`.
