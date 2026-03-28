# Pipeline Diagram Flow Editor — Design

## Goal

Replace the tab-based pipeline settings UI with a visual flow diagram (n8n-style), making pipeline structure, phase routing, and reject patterns immediately visible and editable.

## Layout

- **Direction:** Left-to-right horizontal flow
- **Fixed endpoints:** BACKLOG (left) and DONE (right) — not draggable, not deletable
- **Phase boxes:** User-defined phases between endpoints, positioned by array index
- **Connections:** SVG arrows for main flow (left-to-right) and curved arrows for reject routing (looping back)
- **Scrollable:** Horizontal scroll for long pipelines

## Phase Box (PhaseNode)

- Rounded rectangle with phase's theme color as left border/tint
- Shows: name, type badge (agent/manual)
- Agent phases have a "reject" output port on bottom edge
- All boxes have input port (left) and output port (right) for main flow
- "+" buttons between adjacent boxes for inserting new phases

## Interactions

### Drag-and-drop reorder
Grab a phase box and drag horizontally. Other boxes shift. BACKLOG/DONE are fixed.

### Drag-to-connect (reject routing)
Mousedown on bottom "reject" port, drag line to target phase. Drop to create reject route. Drop on empty space cancels. Click existing reject edge to delete.

### Click to edit
Opens a dialog with: name, type, theme color picker, prompt textarea, tool roles, custom tools, reject pattern, reject target dropdown, delete button.

### Add phase
"+" button between boxes shows popover with templates: Planning, Implementation, Code Review, Custom. Inserts at that position.

### Theme color
Each phase has optional `color` field (hex). Color picker in edit dialog with preset palette. Defaults per template:
- Planning: `#6B7FD7` (blue)
- Implementation: `#4DA870` (green)
- Code Review: `#D4A843` (amber)
- Human Review: `#9B6DC6` (purple)
- Custom: `#7C8894` (gray)

## Data Model

One new optional field on `AIPipelinePhase`:

```typescript
color?: string  // hex color for diagram box
```

Everything else unchanged. Pipeline array order = left-to-right position. Reject routing uses existing `rejectPattern` + `rejectTarget`.

## Technology

**Library:** `@xyflow/react` (React Flow v12+)

React Flow handles: custom nodes, drag-and-drop, edge connections, SVG rendering, drag-from-port wiring.

## Components

| Component | Purpose |
|-----------|---------|
| `PipelineDiagram.tsx` | Main flow editor — wraps `<ReactFlow>`, manages nodes/edges, handles add/delete/reorder |
| `PhaseNode.tsx` | Custom React Flow node — phase box with color, name, type badge, ports |
| `RejectEdge.tsx` | Custom edge — curved arrow with label for reject routing |
| `PhaseEditDialog.tsx` | Edit dialog — phase config form (extracted from existing PipelinePhaseCard) |

## Integration

- Replace `PipelineTab` + `PipelinePhaseCard` in `AISettings.tsx` with `PipelineDiagram`
- `PipelineDiagram` takes `pipeline` prop and calls `onPipelineChange` on modifications
- No backend/store/IPC changes

## Files Changed

| File | Change |
|------|--------|
| `package.json` | Add `@xyflow/react` |
| `types.d.ts` | Add `color?: string` to `AIPipelinePhase` |
| `src/electron/storage/store.ts` | Add default colors to `DEFAULT_PIPELINE` |
| `src/ui/components/ai-automation/PipelineDiagram.tsx` | New |
| `src/ui/components/ai-automation/PhaseNode.tsx` | New |
| `src/ui/components/ai-automation/RejectEdge.tsx` | New |
| `src/ui/components/ai-automation/PhaseEditDialog.tsx` | New |
| `src/ui/views/AISettings.tsx` | Replace PipelineTab with PipelineDiagram |

## Not in scope (future)

- Multiple reject targets per phase
- Zoom/pan controls
- Minimap for large pipelines
