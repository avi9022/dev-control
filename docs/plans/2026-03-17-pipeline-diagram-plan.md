# Pipeline Diagram Flow Editor — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the flat list pipeline settings UI with a visual left-to-right flow diagram using React Flow, with drag-and-drop reorder, drag-to-connect reject routing, click-to-edit dialogs, and theme colors.

**Architecture:** React Flow (`@xyflow/react`) renders phase boxes as custom nodes with SVG edge connections. The pipeline data shape stays the same (just adding optional `color` field). A side dialog handles phase editing. The `PipelineTab` and `PipelinePhaseCard` in AISettings.tsx are replaced by the new `PipelineDiagram` component.

**Tech Stack:** `@xyflow/react` v12+, existing Radix UI components, existing CSS variable theming

**Note:** This project has no test suite. Steps focus on implementation and visual verification.

---

### Task 1: Install dependency and update types

**Files:**
- Modify: `package.json`
- Modify: `types.d.ts`
- Modify: `src/electron/storage/store.ts`

**Step 1: Install @xyflow/react**

Run: `npm install @xyflow/react`

**Step 2: Add `color` field to `AIPipelinePhase` in `types.d.ts`**

Find `interface AIPipelinePhase` and add after `rejectTarget`:
```typescript
  color?: string
```

**Step 3: Add default colors to `DEFAULT_PIPELINE` in `store.ts`**

Add `color` to each phase in the default pipeline:
- planning: `color: '#6B7FD7'`
- in-progress: `color: '#4DA870'`
- agent-review: `color: '#D4A843'`
- human-review: `color: '#9B6DC6'`

**Step 4: Add default colors to `PHASE_TEMPLATES` in `AISettings.tsx`**

Update the `PHASE_TEMPLATES` type and entries to include `color`:
- Implementation: `color: '#4DA870'`
- Planning: `color: '#6B7FD7'`
- Code Review: `color: '#D4A843'`
- Custom: `color: '#7C8894'`

**Step 5: Commit**

```bash
git add package.json package-lock.json types.d.ts src/electron/storage/store.ts src/ui/views/AISettings.tsx
git commit -m "feat(pipeline): add @xyflow/react and color field to pipeline phases"
```

---

### Task 2: Create PhaseNode custom node component

**Files:**
- Create: `src/ui/components/ai-automation/PhaseNode.tsx`

**Step 1: Create the custom node component**

This is a React Flow custom node. It renders a phase box with:
- Left border colored by `phase.color`
- Phase name (text)
- Type badge (agent/manual)
- Input handle (left, type `target`) for main flow
- Output handle (right, type `source`) for main flow
- Bottom handle (type `source`, id `reject`) only for agent phases — this is the reject routing port
- The node data will be: `{ phase: AIPipelinePhase, onEdit: (id) => void }`

```typescript
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { FC } from 'react'

interface PhaseNodeData {
  phase: AIPipelinePhase
  onEdit: (id: string) => void
}

// Use Node generic: type PhaseNode = Node<PhaseNodeData, 'phase'>
```

Key styling:
- `min-width: 160px`, padding, rounded corners
- Left border `4px solid ${phase.color || '#7C8894'}`
- Background: `var(--ai-surface-2)`
- Border: `1px solid var(--ai-border-subtle)`
- Click handler calls `data.onEdit(data.phase.id)`
- Bottom reject handle: small circle, only visible for agent phases, styled with `var(--ai-warning)` color

**Step 2: Commit**

```bash
git add src/ui/components/ai-automation/PhaseNode.tsx
git commit -m "feat(pipeline): create PhaseNode custom node component"
```

---

### Task 3: Create RejectEdge custom edge component

**Files:**
- Create: `src/ui/components/ai-automation/RejectEdge.tsx`

**Step 1: Create the custom edge component**

This renders a curved SVG path for reject routing connections. Uses React Flow's `getBezierPath` or `getSmoothStepPath` with custom offsets to curve below the main flow.

```typescript
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react'
```

Key details:
- Edge path curves downward (positive Y offset) to visually distinguish from the main flow
- Styled with `var(--ai-warning)` color, dashed stroke
- Small label showing "reject" or the reject pattern text
- Arrow marker at the end

**Step 2: Commit**

```bash
git add src/ui/components/ai-automation/RejectEdge.tsx
git commit -m "feat(pipeline): create RejectEdge custom edge component"
```

---

### Task 4: Create PhaseEditDialog component

**Files:**
- Create: `src/ui/components/ai-automation/PhaseEditDialog.tsx`

**Step 1: Create the edit dialog**

Extract the existing form fields from `PipelinePhaseCard` (AISettings.tsx lines 242-338) into a standalone Dialog component. Add a color picker section.

Props:
```typescript
interface PhaseEditDialogProps {
  phase: AIPipelinePhase | null
  allPhases: AIPipelinePhase[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (id: string, updates: Partial<AIPipelinePhase>) => void
  onDelete: (id: string) => void
  themeClass: string
}
```

Form fields (same as existing PipelinePhaseCard):
- Name input
- Type select (agent/manual)
- Color picker: row of 8 preset color swatches (`#6B7FD7`, `#4DA870`, `#D4A843`, `#9B6DC6`, `#7C8894`, `#D46B6B`, `#6BBDD4`, `#D4916B`). Clicking a swatch sets the color. Active swatch has a ring/checkmark.
- System Prompt textarea (agent only)
- Tool Roles checkboxes (agent only) — reuse `ROLE_DEFINITIONS` (move to shared location or import)
- Custom Tools input (agent only)
- Reject Pattern input (agent only)
- Reject Target dropdown (agent only)
- Delete Phase button at bottom

Use local state for text fields with onBlur commits (same pattern as existing `PipelinePhaseCard`).

**Step 2: Move `ROLE_DEFINITIONS` and `PHASE_TEMPLATES` to a shared file**

Create `src/ui/components/ai-automation/pipeline-constants.ts` with both constants exported, then import from both `AISettings.tsx` and `PhaseEditDialog.tsx`.

**Step 3: Commit**

```bash
git add src/ui/components/ai-automation/PhaseEditDialog.tsx src/ui/components/ai-automation/pipeline-constants.ts
git commit -m "feat(pipeline): create PhaseEditDialog and extract shared constants"
```

---

### Task 5: Create PipelineDiagram main component

**Files:**
- Create: `src/ui/components/ai-automation/PipelineDiagram.tsx`

**Step 1: Create the main diagram component**

This is the core component. It wraps `<ReactFlow>` and manages:

Props:
```typescript
interface PipelineDiagramProps {
  settings: AIAutomationSettings
  updateSettings: (updates: Partial<AIAutomationSettings>) => void
  themeClass: string
}
```

Key responsibilities:

**Node generation** (`useMemo`):
- BACKLOG node at position `{x: 0, y: 100}` — fixed, not draggable, custom type `endpoint`
- Phase nodes at positions `{x: (index + 1) * 250, y: 100}` — draggable, custom type `phase`
- DONE node at position `{x: (pipeline.length + 1) * 250, y: 100}` — fixed, not draggable, custom type `endpoint`
- "+" add buttons between nodes — custom type `addButton` at midpoints

**Edge generation** (`useMemo`):
- Main flow edges: connect each node to the next (BACKLOG → phase1 → phase2 → ... → DONE), type `default`, animated
- Reject edges: for each phase with `rejectTarget`, connect from `sourceHandle: 'reject'` to target node, type `reject`

**Node types registry:**
```typescript
const nodeTypes = { phase: PhaseNode, endpoint: EndpointNode, addButton: AddButtonNode }
const edgeTypes = { reject: RejectEdge }
```

**EndpointNode**: Simple custom node for BACKLOG/DONE — just a label in a muted box, only has output handle (BACKLOG) or input handle (DONE).

**AddButtonNode**: Small "+" circle between phases. On click, shows template popover. Passes the insert index via node data.

**Drag-and-drop reorder:**
- Use `onNodeDragStop` to detect when a phase node is dropped
- Calculate new index based on X position relative to other nodes
- Reorder the pipeline array and call `updateSettings`

**Drag-to-connect:**
- Use `onConnect` callback from React Flow
- When a connection is made from a `reject` source handle to a target node:
  - Find the source phase
  - Set its `rejectTarget` to the target phase id
  - If `rejectPattern` is empty, set a default like `REVIEW_DECISION: REJECT`
- Only allow connections from `reject` handles (validate in `isValidConnection`)

**Delete reject connection:**
- Use `onEdgesDelete` or `onEdgeClick` to handle removing reject routing
- Clear `rejectTarget` and optionally `rejectPattern` on the source phase

**Click to edit:**
- `onEdit` callback passed to PhaseNode data opens `PhaseEditDialog`

**React Flow config:**
- `fitView` on initial render
- Disable zoom/pan controls (simple horizontal flow doesn't need it), or keep pan only
- Set `proOptions={{ hideAttribution: true }}` if on paid plan, otherwise leave attribution

**Step 2: Import React Flow CSS**

Add to the component or to a parent:
```typescript
import '@xyflow/react/dist/style.css'
```

**Step 3: Commit**

```bash
git add src/ui/components/ai-automation/PipelineDiagram.tsx
git commit -m "feat(pipeline): create PipelineDiagram main flow editor component"
```

---

### Task 6: Wire PipelineDiagram into AISettings

**Files:**
- Modify: `src/ui/views/AISettings.tsx`

**Step 1: Replace PipelineTab**

In `AISettings.tsx`:
- Import `PipelineDiagram` from the new component
- Replace the `<PipelineTab>` usage (line 61) with `<PipelineDiagram>`
- Pass `settings`, `updateSettings`, and `themeClass` props
- Delete the `PipelineTab` component (lines 95-189)
- Delete the `PipelinePhaseCard` component (lines 191-342)
- Remove `ROLE_DEFINITIONS` and `PHASE_TEMPLATES` from this file (now in `pipeline-constants.ts`)
- Clean up unused imports (`ChevronUp`, `ChevronDown`, etc.)

The TabsContent for pipeline should give the diagram enough height:
```tsx
<TabsContent value="pipeline" className="flex-1 min-h-0 overflow-hidden px-4 pb-4">
  <PipelineDiagram settings={settings} updateSettings={updateSettings} themeClass={themeClass} />
</TabsContent>
```

Note: the `themeClass` needs to be available in AISettings. Check how it's obtained — likely from the settings modal parent or from `settings.theme`. Add it if needed.

**Step 2: Verify lint passes**

Run: `npx eslint src/ui/views/AISettings.tsx src/ui/components/ai-automation/PipelineDiagram.tsx src/ui/components/ai-automation/PhaseNode.tsx src/ui/components/ai-automation/RejectEdge.tsx src/ui/components/ai-automation/PhaseEditDialog.tsx`

Expected: No new errors

**Step 3: Commit**

```bash
git add src/ui/views/AISettings.tsx
git commit -m "feat(pipeline): wire PipelineDiagram into settings, remove old list UI"
```

---

### Task 7: Visual polish and testing

**Files:**
- Modify: `src/ui/components/ai-automation/PipelineDiagram.tsx` (as needed)
- Modify: `src/ui/components/ai-automation/PhaseNode.tsx` (as needed)

**Step 1: Manual testing checklist**

Verify these interactions work:
- [ ] Diagram renders with existing pipeline phases
- [ ] BACKLOG and DONE are visible and fixed
- [ ] Phase boxes show name, type badge, and color
- [ ] Clicking a phase box opens the edit dialog
- [ ] Editing name/prompt/tools saves correctly
- [ ] Changing color updates the box immediately
- [ ] "+" button between phases shows template popover
- [ ] Adding a phase inserts at the correct position
- [ ] Deleting a phase via dialog removes it and clears any reject targets pointing to it
- [ ] Dragging a phase box reorders the pipeline
- [ ] Dragging from reject port to another phase creates a reject edge
- [ ] Reject edges show as curved dashed arrows below the flow
- [ ] Deleting a reject edge clears the routing
- [ ] Default pipeline (4 phases) renders correctly on first load

**Step 2: Fix any issues found during testing**

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(pipeline): visual flow diagram editor complete"
```
