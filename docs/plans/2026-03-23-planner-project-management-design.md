# Planner Project Management — Design

## Overview

Enable the planner agent to create new projects via a user-confirmed modal, so tasks for new codebases have proper project directories, git repos, and board assignments from the start.

## Problem

When the planner creates tasks for a new project that doesn't exist yet, there's no project folder, no git repo, and no registered DevControl project. Tasks can't be tagged with a project, can't get worktrees, and agents resort to creating ad-hoc directories inside their task folders. Subsequent tasks are blind to each other's work.

## Roadmap

### Phase 1: Project Creation via MCP Tool (this design)
- New MCP tool `request_project_creation` opens a user-facing modal
- User confirms name, location, git init, and board selection
- Project created and registered, planner continues with project-aware tasks

### Phase 2: Planner Tags Projects in Tasks
- Planner assigns the correct project(s) to each task it creates
- Uses `create_task` tool's existing `projectPaths` parameter
- System prompt updated with instructions to always tag projects

### Phase 3: Planner Uses Task Cross-References
- Planner links related tasks using `#shortId` syntax (F46)
- Agents working on later tasks can explore earlier tasks' directories

### Phase 4: Planner Uses Task Dependencies
- Planner marks task ordering using F48 dependency system
- "Create skeleton" blocks "add first feature"

---

## Phase 1 Design

### MCP Tool: `request_project_creation`

**Input:**
```typescript
{
  suggestedName: string
}
```

**Output (success):**
```typescript
{
  projectPath: string
  projectName: string
  projectId: string
  boardId: string
  boardName: string
}
```

**Output (cancelled):**
```typescript
{
  cancelled: true
}
```

**Output (timed out):**
```typescript
{
  timedOut: true
}
```

### Modal UI

Dialog overlays the planner chat with fields:

**Project Setup:**
- Project Name — text input, prefilled with `suggestedName`
- Location — directory picker (native folder dialog), default: last used project directory or home
- Git Init — checkbox, default checked

**Board Setup:**
- Radio toggle: "Create new board" / "Use existing board"
  - New: text input for board name (prefilled with project name)
  - Existing: dropdown of existing boards

**Actions:**
- Create — validates inputs, creates everything, resolves MCP tool promise
- Cancel — closes modal, resolves with `{ cancelled: true }`

### Backend Flow (on Create)

1. Create directory: `mkdir -p {location}/{projectName}`
2. Git init (if checked): `git init` + `git commit --allow-empty -m "Initial commit"`
3. Register as DevControl project in the directories store
4. Create new board or select existing board
5. Broadcast updates (directories + tasks)
6. Resolve MCP tool promise with project details

### Timeout Handling

- Main process sets a 55-second timer when modal opens (5s buffer before 60s MCP timeout)
- On timer fire: close modal via IPC, resolve with `{ timedOut: true }`
- Planner system prompt instructs: offer retry or continue with existing project

### Cancel Handling

- User clicks Cancel or Escape → resolve with `{ cancelled: true }`
- Planner responds conversationally: "No problem. Want to try again or use an existing project?"

### IPC Events

```
Main → Renderer:
  aiShowProjectCreationModal:  { suggestedName: string, requestId: string }
  aiCloseProjectCreationModal: { requestId: string }

Renderer → Main:
  aiProjectCreationResult: { requestId: string, result: ProjectCreationResult }
```

### Request Tracking

Module-level `Map<string, { resolve, timer }>` in the MCP tool handler:
- Each call generates a requestId, stores the promise resolve function + timeout timer
- Renderer sends result → main looks up requestId → resolves promise
- Timer cleanup on resolve/cancel/timeout

### Types

```typescript
interface ProjectCreationResult {
  cancelled?: boolean
  projectName: string
  location: string
  gitInit: boolean
  boardMode: 'new' | 'existing'
  newBoardName?: string
  existingBoardId?: string
}
```

### System Prompt Changes

Add to `planner-prompt.ts`:

**In Step 2 (Gather Context):**
> If the user's goal involves creating a new codebase or project that doesn't exist yet, use `request_project_creation` to set up the project directory. This opens a form for the user to confirm the project name, location, and board. Wait for the result before creating tasks.

**Recovery instruction:**
> If `request_project_creation` times out or the user cancels, say: "It looks like the project setup wasn't completed. Would you like to try again, or should we work with an existing project?" Do not proceed to create tasks without a project — tasks need a registered project for worktrees to work.

### New Files

- `src/electron/ai-automation/mcp-tools/request-project-creation.ts`
- `src/ui/components/ai-automation/ProjectCreationModal.tsx`

### Modified Files

- `src/electron/ai-automation/mcp-tools/index.ts` — register new tool
- `src/electron/ai-automation/planner-prompt.ts` — add project creation instructions
- `src/electron/handlers/ai-handlers.ts` — register new IPC handlers
- `src/electron/preload.cts` — expose new IPC methods
- `types/ipc.d.ts` — add new event types
- `src/ui/components/ai-automation/PlannerChat.tsx` — listen for modal event, render modal
