# P5: Planner Project Creation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable the planner agent to create new projects via a user-confirmed modal, so tasks for new codebases get proper directories, git repos, and board assignments.

**Architecture:** New MCP tool `request_project_creation` sends IPC to renderer to open a modal. Main process holds a promise that resolves when user submits/cancels/timeout. Project directory created, git initialized, registered in store, board created or selected. Result returned to planner via MCP.

**Tech Stack:** Electron IPC, MCP tool handler, React modal component, `execFile` for git commands

---

### Task 1: Add IPC types

**Files:**
- Modify: `types/ipc.d.ts`
- Create: `types/planner.d.ts`

**Step 1: Create planner types**

Create `types/planner.d.ts`:

```typescript
interface ProjectCreationRequest {
  suggestedName: string
  requestId: string
}

interface ProjectCreationFormData {
  projectName: string
  location: string
  gitInit: boolean
  boardMode: 'new' | 'existing'
  newBoardName?: string
  existingBoardId?: string
}

interface ProjectCreationResponse {
  cancelled?: boolean
  timedOut?: boolean
  formData?: ProjectCreationFormData
}

interface ProjectCreationToolResult {
  projectPath: string
  projectName: string
  projectId: string
  boardId: string
  boardName: string
}
```

**Step 2: Add IPC events to EventPayloadMapping**

In `types/ipc.d.ts`, add:

```typescript
aiShowProjectCreationModal: {
  args: [ProjectCreationRequest]
  return: void
}
aiCloseProjectCreationModal: {
  args: [{ requestId: string }]
  return: void
}
aiProjectCreationResult: {
  args: [{ requestId: string; result: ProjectCreationResponse }]
  return: void
}
```

**Step 3: Add to Window interface**

In the Window interface section of `types/ipc.d.ts`, add:

```typescript
aiProjectCreationResult: (requestId: string, result: ProjectCreationResponse) => Promise<void>
subscribeAIProjectCreationModal: (callback: (request: ProjectCreationRequest) => void) => () => void
subscribeAICloseProjectCreationModal: (callback: (data: { requestId: string }) => void) => () => void
```

---

### Task 2: Add preload bridge methods

**Files:**
- Modify: `src/electron/preload.cts`

Add in the `exposeInMainWorld` object:

```typescript
aiProjectCreationResult: (requestId: string, result: ProjectCreationResponse) =>
  ipcInvoke('aiProjectCreationResult', { requestId, result }),
subscribeAIProjectCreationModal: (callback: (request: ProjectCreationRequest) => void) =>
  ipcOn('aiShowProjectCreationModal', (request) => callback(request)),
subscribeAICloseProjectCreationModal: (callback: (data: { requestId: string }) => void) =>
  ipcOn('aiCloseProjectCreationModal', (data) => callback(data)),
```

---

### Task 3: Create the MCP tool

**Files:**
- Create: `src/electron/ai-automation/mcp-tools/request-project-creation.ts`
- Modify: `src/electron/ai-automation/mcp-tools/index.ts`

**Step 1: Create the tool file**

`request-project-creation.ts` needs to:
1. Accept `{ suggestedName: string }` as input
2. Generate a `requestId` via `randomUUID()`
3. Send IPC to renderer: `aiShowProjectCreationModal` with suggestedName + requestId
4. Create a Promise and store the resolve function + a 55-second timeout timer in a module-level Map
5. Wait for the promise to resolve
6. On resolve: check if cancelled/timedOut, otherwise create the project
7. Return the result to the planner

Project creation logic (when user submits):
1. Create directory: `fs.mkdirSync(path.join(location, projectName), { recursive: true })`
2. Git init if checked: `execFile('git', ['init'])` then `execFile('git', ['commit', '--allow-empty', '-m', 'Initial commit'])`
3. Register as DevControl project using `addDirectoryToStore(projectPath)` then update the `customLabel`
4. Create board or use existing (reuse logic from `create-board` tool)
5. Broadcast directory changes
6. Return `{ projectPath, projectName, projectId, boardId, boardName }`

Also export a `resolveProjectCreation(requestId, result)` function that main.ts IPC handler will call.

The tool must also export a `closeAllPendingModals()` for cleanup on app quit.

**Step 2: Register in index.ts**

Import and add to the `mcpTools` array.

**Step 3: Add to planner's allowed tools**

The planner-runner.ts now auto-derives `--allowedTools` from the mcpTools array, so this is automatic.

---

### Task 4: Register IPC handlers

**Files:**
- Modify: `src/electron/handlers/ai-handlers.ts`

Add a handler for `aiProjectCreationResult`:

```typescript
ipcMainHandle('aiProjectCreationResult', async (_event, { requestId, result }) => {
  resolveProjectCreation(requestId, result)
})
```

Import `resolveProjectCreation` from the MCP tool file.

---

### Task 5: Create the modal component

**Files:**
- Create: `src/ui/components/ai-automation/ProjectCreationModal.tsx`

The modal component:
- Listens for `subscribeAIProjectCreationModal` to open
- Listens for `subscribeAICloseProjectCreationModal` to force-close (timeout)
- Shows a dialog with fields:
  - Project Name (text input, prefilled)
  - Location (text display + "Browse" button that calls `window.electron.openDirectoryPicker` or similar)
  - Git Init (checkbox, default checked)
  - Board mode (radio: "Create new board" / "Use existing board")
    - New: text input for board name (prefilled with project name)
    - Existing: Select dropdown of boards from AI automation context
- Create button: validates, calls `window.electron.aiProjectCreationResult(requestId, formData)`
- Cancel button: calls `window.electron.aiProjectCreationResult(requestId, { cancelled: true })`

Styling: same warm charcoal theme as other dialogs using `var(--ai-*)` CSS variables.

For the directory picker, check if `window.electron` already has a file/directory dialog method. If not, add one via a new IPC handler that calls `dialog.showOpenDialog({ properties: ['openDirectory'] })`.

---

### Task 6: Render modal in PlannerChat

**Files:**
- Modify: `src/ui/components/ai-automation/PlannerChat.tsx`

Add state and subscription:

```typescript
const [projectCreationRequest, setProjectCreationRequest] = useState<ProjectCreationRequest | null>(null)

useEffect(() => {
  const unsubShow = window.electron.subscribeAIProjectCreationModal((request) => {
    setProjectCreationRequest(request)
  })
  const unsubClose = window.electron.subscribeAICloseProjectCreationModal(() => {
    setProjectCreationRequest(null)
  })
  return () => { unsubShow(); unsubClose() }
}, [])
```

Render the modal:

```tsx
{projectCreationRequest && (
  <ProjectCreationModal
    request={projectCreationRequest}
    onComplete={() => setProjectCreationRequest(null)}
  />
)}
```

---

### Task 7: Update planner system prompt

**Files:**
- Modify: `src/electron/ai-automation/planner-prompt.ts`

Update Step 2 (Gather Context):

```
### Step 2: Gather Context
Use your tools to understand what already exists:
- Use \`list_projects\` to see what projects/repos the user has
- Use \`list_boards\` to see existing kanban boards
- Use \`list_knowledge_docs\` to see what documentation exists
- Use \`read_knowledge_doc\` to read relevant docs if needed

**If the goal involves a brand new project/codebase that doesn't exist yet:**
- Use \`request_project_creation\` to set up the project. This opens a form for the user to confirm the name, location, and board.
- Wait for the result before proceeding to task creation.
- If the user cancels or the request times out, ask: "The project setup wasn't completed. Would you like to try again, or should we work with an existing project?"
```

Update Step 4 (Identify Projects) to mention the newly created project:

```
### Step 4: Identify Projects
Figure out which registered projects are relevant to this work:
- If you just created a new project with \`request_project_creation\`, use that project for the tasks.
- Otherwise, look at the projects list and identify which ones relate to the user's goal.
- Confirm with the user: "I think this work involves [project names]. Is that correct?"
```

---

### Task 8: Manual verification

Since this project has no test suite, verify manually:

1. Open the planner chat
2. Describe a new project goal: "I want to build a new React app called MyApp"
3. Planner should call `list_projects`, see no match, call `request_project_creation`
4. Modal should appear with "MyApp" prefilled
5. Pick a location, choose "Create new board", click Create
6. Verify: directory created, git repo initialized, project appears in sidebar, board created
7. Planner should continue creating tasks with the project tagged
8. Test cancel: repeat but click Cancel — planner should offer retry
9. Test timeout: repeat but wait 55+ seconds — modal should close, planner should recover
10. Test existing board: repeat but choose "Use existing board" and select one
