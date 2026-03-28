# Task Creation Stepper — Design

## Overview

When the planner calls `create_tasks`, instead of creating tasks immediately, a stepper modal opens where the user reviews and edits each task before approving. Tasks are only created after the user approves all of them.

## Flow

1. Planner calls `create_tasks` MCP tool with a JSON array of proposed tasks
2. MCP tool sends IPC to renderer with the proposed tasks + a requestId
3. Stepper modal opens showing the first task as a full edit form
4. User reviews/edits the task, clicks "Approve" to move to the next
5. "Back" button goes to the previous task (with slide animation)
6. After approving the last task, all tasks are created at once
7. Modal closes, MCP tool returns the created task IDs to the planner
8. If user cancels at any point, no tasks are created, planner is informed

## Stepper UI

### Header
- Progress dots showing current position (filled = approved, hollow = pending, highlighted = current)
- Text: "Task 2 of 4 — Task Title"

### Body
Each step is a full task edit form (extracted from NewTaskDialog):
- Title (text input)
- Description (contentEditable with @ project tagging and # task references)
- Tagged projects with per-project config (strategy, base branch, branch name)
- Attachments (file picker)

### Footer
- "Back" button (disabled on first task)
- "Cancel" button
- "Approve" button (moves to next task, or "Create All" on the last task)

### Slide Animation
- Moving forward: current form slides left, next slides in from right
- Moving back: current form slides right, previous slides in from left
- CSS transition on a transform/translate wrapper

## Data Flow

### MCP Tool → Modal
```
aiShowTaskCreationStepper: {
  requestId: string
  boardId: string
  tasks: Array<{
    title: string
    description: string
    projectPaths?: string
  }>
}
```

### Modal → MCP Tool (on approve all)
```
aiTaskCreationStepperResult: {
  requestId: string
  result: {
    cancelled?: boolean
    timedOut?: boolean
    tasks?: Array<{
      title: string
      description: string
      projects: AITaskProject[]
      attachments: string[]
    }>
  }
}
```

### Timeout
Same pattern as project creation: 55-second timer. On timeout, close modal, resolve with `{ timedOut: true }`.

BUT — 55 seconds is not enough for reviewing multiple tasks. The timer should reset on each user interaction (approve, back, edit). This way the timeout only fires if the user is idle for 55 seconds.

## Component Architecture

### Extract from NewTaskDialog
The task form (title + description editor + project config + attachments) is currently inline in NewTaskDialog.tsx. Extract into a reusable `TaskForm` component:

```
TaskForm — stateless form component
  Props:
    title, onTitleChange
    descriptionRef (MentionEditorHandle)
    taggedProjects, onProjectTagged, onProjectRemoved
    projectConfigs, onProjectConfigChange
    pendingFiles, onFilesChange
    boardId
```

NewTaskDialog uses TaskForm internally. The stepper also uses TaskForm for each step.

### New Components
- `TaskCreationStepper.tsx` — the stepper modal with slide animation and step navigation
- `TaskForm.tsx` — extracted reusable task edit form

### Modified Components
- `NewTaskDialog.tsx` — refactored to use TaskForm
- `PlannerChat.tsx` — subscribe to stepper show/close events

## IPC Events

```
Main → Renderer:
  aiShowTaskCreationStepper:  { requestId, boardId, tasks }
  aiCloseTaskCreationStepper: { requestId }

Renderer → Main:
  aiTaskCreationStepperResult: { requestId, result }
```

## MCP Tool Changes

`create_tasks` tool changes from creating tasks directly to:
1. If called from the planner (mainWindow available): send IPC to show stepper, wait for response
2. On approve: create all tasks with the user's edited data
3. On cancel/timeout: return appropriate message to planner

The tool keeps the direct creation as a fallback for non-planner callers (pipeline agents that use the tool).

## Files

### New
- `src/ui/components/ai-automation/TaskForm.tsx` — extracted reusable form
- `src/ui/components/ai-automation/TaskCreationStepper.tsx` — stepper modal

### Modified
- `src/ui/components/ai-automation/NewTaskDialog.tsx` — use TaskForm
- `src/ui/components/ai-automation/PlannerChat.tsx` — subscribe to stepper events
- `src/electron/ai-automation/mcp-tools/create-tasks.ts` — add IPC modal flow
- `types/planner.d.ts` — add stepper types
- `types/ipc.d.ts` — add stepper IPC events
- `src/electron/preload.cts` — add stepper bridge methods
- `src/electron/handlers/ai-handlers.ts` — add stepper result handler
