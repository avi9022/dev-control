# Task Amendments Design

## Problem
When a task is completed but needs additions or new requirements, the only option is to misuse review comments. There's no dedicated way to add new requirements to an existing task and send it back through the pipeline.

## Solution
Add an "amendments" system — users can write new requirements on a task, pick a target pipeline phase, and the task re-enters the pipeline from that phase. The agent sees amendments as distinct from the original description and focuses on the new requirements.

## Data Model

New interface:
```typescript
interface AITaskAmendment {
  id: string
  text: string           // new requirement, supports @mentions
  targetPhase: string    // phase ID where task re-entered
  createdAt: string
}
```

New field on `AITask`:
```typescript
amendments?: AITaskAmendment[]
```

## Prompt Builder Integration

When a task has amendments, the prompt builder adds a section after the original description:

```
## Original Task
{task.description}

## Amendments
The following requirements were added after initial implementation.
Your existing work already addresses the original task — focus on these additions:

### Amendment 1 (2026-03-10)
{amendment.text}

### Amendment 2 (2026-03-11)
{amendment.text}
```

The agent also sees existing diffs (so it knows what's done) and understands that amendments are incremental work regardless of which phase it's in (planning, implementation, review, etc.).

## UI

### Amendments Tab (AITaskDetail)
- Always visible in task detail (even when empty, for discoverability)
- Lists past amendments with text, timestamp, and target phase
- "Add Amendment" button opens inline form:
  - ContentEditable with @mention chip support (reuse from NewTaskDialog)
  - Phase picker dropdown (pipeline phases, excluding BACKLOG/DONE)
  - Submit button

### Quick Action Button (Task Detail Header)
- "Add Amendment" button in the task detail header toolbar
- Opens a dialog with the same form (contentEditable + phase picker)
- Available from any tab for quick access

Both use the same underlying form component.

## Flow

1. User clicks "Add Amendment" (header button or Amendments tab)
2. Writes new requirement with optional @mentions, picks target phase
3. On submit:
   - Amendment appended to `task.amendments[]`
   - Task `phase` set to selected target phase
   - Task `updatedAt` refreshed
   - If target phase is `agent` type, pipeline picks it up automatically
   - If `manual` type, task waits for manual action
4. Agent runs with full prompt (original description + all amendments + diffs + comments)
5. Task proceeds through pipeline normally from that phase

## Implementation Notes

- No new IPC handlers — use existing `aiUpdateTask` to add amendments and change phase
- Reuse contentEditable mention component from NewTaskDialog
- Prompt builder changes in `src/electron/ai-automation/prompt-builder.ts`
- New `AmendmentForm` shared component used by both the tab and the dialog
- New `AmendmentsTab` component in `src/ui/components/ai-automation/`
