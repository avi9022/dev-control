# Task Creation Stepper — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When the planner calls `create_tasks`, show a stepper modal where the user reviews/edits each task before creation.

**Architecture:** Blocking MCP tool call opens a stepper modal via IPC. User steps through tasks with slide animation, editing each. On final approve, all tasks created at once. Same pattern as project creation modal.

**Tech Stack:** React, CSS transitions for slide animation, MCP tool handler with promise/timeout pattern

---

### Task 1: Add types and IPC events

**Files:**
- Modify: `types/planner.d.ts`
- Modify: `types/ipc.d.ts`

Add to `types/planner.d.ts`:

```typescript
interface TaskStepperProposedTask {
  title: string
  description: string
  projectPaths?: string
}

interface TaskStepperRequest {
  requestId: string
  boardId: string
  tasks: TaskStepperProposedTask[]
}

interface TaskStepperApprovedTask {
  title: string
  description: string
  projects: AITaskProject[]
  attachments: string[]
}

interface TaskStepperResponse {
  cancelled?: boolean
  timedOut?: boolean
  tasks?: TaskStepperApprovedTask[]
}
```

Add to `types/ipc.d.ts` EventPayloadMapping:

```typescript
aiShowTaskCreationStepper: {
  args: [TaskStepperRequest]
  return: void
}
aiCloseTaskCreationStepper: {
  args: [{ requestId: string }]
  return: void
}
aiTaskCreationStepperResult: {
  args: [{ requestId: string; result: TaskStepperResponse }]
  return: void
}
```

Add to Window interface:

```typescript
aiTaskCreationStepperResult: (requestId: string, result: TaskStepperResponse) => Promise<void>
subscribeAITaskCreationStepper: (callback: (request: TaskStepperRequest) => void) => () => void
subscribeAICloseTaskCreationStepper: (callback: (data: { requestId: string }) => void) => () => void
```

---

### Task 2: Add preload bridge + IPC handler

**Files:**
- Modify: `src/electron/preload.cts`
- Modify: `src/electron/handlers/ai-handlers.ts`

Preload — add 3 methods matching the Window interface.

ai-handlers — add:
- `aiTaskCreationStepperResult` handler that calls a `resolveTaskCreationStepper` function
- Import from the modified create-tasks.ts

---

### Task 3: Extract TaskForm from NewTaskDialog

**Files:**
- Create: `src/ui/components/ai-automation/TaskForm.tsx`
- Modify: `src/ui/components/ai-automation/NewTaskDialog.tsx`

Extract the form body (title, description editor, project configs, attachments) into a standalone `TaskForm` component.

TaskForm props:
```typescript
interface TaskFormProps {
  title: string
  onTitleChange: (title: string) => void
  descriptionRef: React.RefObject<MentionEditorHandle | null>
  taggedProjects: DirectorySettings[]
  onProjectTagged: (dir: DirectorySettings) => void
  onProjectRemoved: (id: string) => void
  projectConfigs: Record<string, { gitStrategy: AIGitStrategy; branchName: string; baseBranch: string }>
  onProjectConfigChange: (id: string, updates: Partial<{ gitStrategy: AIGitStrategy; branchName: string; baseBranch: string }>) => void
  pendingFiles: { name: string; path: string }[]
  onFilesChange: (files: { name: string; path: string }[]) => void
  boardId?: string
  autoFocusTitle?: boolean
  descriptionPlaceholder?: string
}
```

TaskForm renders: title input, MentionEditor for description, tagged project list with config (strategy, branch), attachments with add/remove.

NewTaskDialog is refactored to use TaskForm internally — manages state and passes it down.

---

### Task 4: Build TaskCreationStepper

**Files:**
- Create: `src/ui/components/ai-automation/TaskCreationStepper.tsx`

The stepper modal component:

**Props:**
```typescript
interface TaskCreationStepperProps {
  request: TaskStepperRequest
  onComplete: () => void
}
```

**State (per task):**
- Array of task states: `{ title, description, taggedProjects, projectConfigs, pendingFiles, approved }`
- `currentStep` index
- `slideDirection` for animation ('left' | 'right')

**On mount:**
- Initialize task states from `request.tasks` — parse `projectPaths` into tagged projects/configs

**Header:**
- Progress dots: filled (approved), highlighted (current), hollow (pending)
- "Task N of M — title"

**Body:**
- TaskForm for current step, wrapped in slide animation container
- CSS: `transform: translateX()` with `transition: transform 300ms ease`

**Footer:**
- Back (disabled on step 0)
- Cancel → calls `aiTaskCreationStepperResult(requestId, { cancelled: true })`, calls `onComplete`
- Approve / Create All (last step):
  - Mark current task as approved
  - If not last: advance `currentStep`, set `slideDirection: 'left'`
  - If last: collect all task data, call `aiTaskCreationStepperResult(requestId, { tasks: [...] })`, call `onComplete`

**Slide animation:**
- Wrapper div with `overflow: hidden`
- Inner div: `transition: transform 300ms ease-in-out`, `transform: translateX(${-currentStep * 100}%)`
- Each step rendered side by side with `width: 100%`, `flex-shrink: 0`

---

### Task 5: Modify create_tasks MCP tool

**Files:**
- Modify: `src/electron/ai-automation/mcp-tools/create-tasks.ts`

Add the same blocking pattern as request-project-creation:
- Module-level `pendingRequests` Map
- `setTaskStepperMainWindow()`, `resolveTaskCreationStepper()`, `closeAllPendingSteppers()`
- When `create_tasks` is called:
  1. If mainWindow available: send IPC `aiShowTaskCreationStepper` with proposed tasks
  2. Wait for promise (with activity-aware timeout)
  3. On approve: create all tasks using the user's edited data
  4. On cancel/timeout: return message to planner
  5. If no mainWindow (fallback): create tasks directly (existing behavior)

**Activity-aware timeout:**
- Start 55s timer
- Export `resetTaskStepperTimeout(requestId)` that restarts the timer
- The stepper modal calls this on every user interaction (approve, back, edit)
- This requires a new IPC event: `aiTaskStepperActivity: { requestId: string }`

---

### Task 6: Wire stepper into PlannerChat

**Files:**
- Modify: `src/ui/components/ai-automation/PlannerChat.tsx`

Add state and subscriptions (same pattern as project creation modal):

```typescript
const [taskStepperRequest, setTaskStepperRequest] = useState<TaskStepperRequest | null>(null)

// Subscribe to show/close events
subscribeAITaskCreationStepper → setTaskStepperRequest
subscribeAICloseTaskCreationStepper → setTaskStepperRequest(null)
```

Render:
```tsx
{taskStepperRequest && (
  <TaskCreationStepper
    request={taskStepperRequest}
    onComplete={() => setTaskStepperRequest(null)}
  />
)}
```

---

### Task 7: Register in main.ts + cleanup

**Files:**
- Modify: `src/electron/main.ts`

- Import `setTaskStepperMainWindow` and `closeAllPendingSteppers`
- Call `setTaskStepperMainWindow(mainWindow)` alongside other window setters
- Call `closeAllPendingSteppers()` in the `before-quit` cleanup

---

### Task 8: Verify

- `npx tsc --noEmit` passes
- `npm run transpile:electron` passes
- `npx eslint .` passes
- Manual test: open planner, create tasks, verify stepper opens with correct data, edit a task, approve all, verify tasks created
