# Workflow Builder - TDD Implementation

## Overview
A visual workflow builder built with ReactFlow following Test-Driven Development principles.

## Test-Driven Development Process

### 1. Tests Written First ✅
- **Unit Tests**: `__tests__/unit/components/workflow/`
  - `WorkflowBuilder.test.tsx` - Tests for the main builder component
  - `CustomNode.test.tsx` - Tests for custom node component
- **E2E Tests**: `__tests__/e2e/builder.spec.ts`
  - End-to-end tests for user workflows

### 2. Implementation ✅
- **Components Created**:
  - `src/components/workflow/WorkflowBuilder.tsx` - Main builder component
  - `src/components/workflow/nodes/CustomNode.tsx` - Custom node with styling
  - `src/app/builder/page.tsx` - Builder route page

### 3. Test Results ✅
```
✓ __tests__/unit/components/workflow/CustomNode.test.tsx (5 tests)
✓ __tests__/unit/components/workflow/WorkflowBuilder.test.tsx (6 tests)
Test Files: 2 passed (2)
Tests: 11 passed (11)
```

**Coverage**:
- WorkflowBuilder.tsx: 93.7% (lines, functions, branches)
- CustomNode.tsx: 100% (lines, functions, branches)

## Features Implemented

### Core Functionality
- ✅ Interactive node-based workflow canvas
- ✅ Drag and drop nodes
- ✅ Connect nodes with edges
- ✅ Add new nodes dynamically
- ✅ Delete selected nodes
- ✅ Visual minimap for navigation
- ✅ Zoom and pan controls
- ✅ Dotted background grid

### Custom Nodes
- ✅ Styled with Tailwind CSS
- ✅ Support for label and description
- ✅ Connection handles (top/bottom)
- ✅ Consistent with design system

### Initial Workflow
The builder initializes with 3 connected nodes:
1. **Start Node** - Beginning of workflow
2. **Process Node** - Main processing step
3. **End Node** - Workflow completion

## Usage

### Access the Builder
1. Navigate to the dev navigation homepage at `http://localhost:3000`
2. Click the **Workflow Builder** card
3. Or directly visit `http://localhost:3000/builder`

### Controls
- **Add Node**: Creates a new node at random position
- **Delete Selected**: Removes selected nodes and their connections
- **MiniMap**: Shows overview of entire workflow
- **Controls**: Zoom in/out, fit view, lock/unlock
- **Drag**: Click and drag nodes to reposition
- **Connect**: Drag from bottom handle to top handle of another node

## Technical Stack

### Dependencies
- **ReactFlow 11.11.3**: Visual workflow library
- **React 18.3.1**: UI framework
- **Next.js 14.2.3**: React framework
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling

### Testing
- **Vitest**: Unit testing
- **@testing-library/react**: Component testing
- **Playwright**: E2E testing
- **jsdom**: DOM environment for tests

## File Structure
```
src/
├── app/
│   ├── builder/
│   │   └── page.tsx          # Builder
│   └── page.tsx              # Dev navigation homepage (links to all routes)
└── components/
    └── workflow/
        ├── WorkflowBuilder.tsx   # Main component
        └── nodes/
            └── CustomNode.tsx    # Custom node component

__tests__/
├── unit/
│   └── components/
│       └── workflow/
│           ├── WorkflowBuilder.test.tsx
│           └── CustomNode.test.tsx
└── e2e/
    └── builder.spec.ts
```

## Next Steps / Enhancements

### Potential Features
- [ ] Save/Load workflows (localStorage/database)
- [ ] Different node types (decision, action, conditional)
- [ ] Node validation and error states
- [ ] Edge labels and conditions
- [ ] Undo/Redo functionality
- [ ] Export workflow as JSON
- [ ] Import workflow from JSON
- [ ] Node search and filter
- [ ] Keyboard shortcuts
- [ ] Auto-layout algorithms

### Testing Improvements
- [ ] Add more edge cases
- [ ] Test drag and drop interactions
- [ ] Test keyboard navigation
- [ ] Performance testing with many nodes

## TDD Principles Followed

1. ✅ **Red-Green-Refactor**: Tests written before implementation
2. ✅ **Comprehensive Coverage**: 93.7-100% coverage on new components
3. ✅ **Test Isolation**: Proper mocking of ReactFlow dependencies
4. ✅ **Clear Assertions**: Specific, meaningful test cases
5. ✅ **Fast Feedback**: Unit tests run in <100ms

## Documentation References

- ReactFlow Docs: https://reactflow.dev
- Context7 Library ID: `/xyflow/xyflow`
- Examples based on official ReactFlow documentation
