# F15: Edit Task & Task Workspace Restructure — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate all task data (agent files, user attachments, worktrees) into a single per-task workspace directory. Add edit-task-in-BACKLOG, file attachments, and configurable task data root. Remove deprecated fields from the hardcoded pipeline era.

**Architecture:** Refactor `task-dir-manager.ts` to create subdirectories (`agent/`, `attachments/`, `worktrees/`) per task. Update `worktree-manager.ts` to place worktrees inside the task directory. Simplify `AITask` by replacing `worktreePath`/`worktreeDir`/`maxReviewCycles`/`reviewCycleCount` with `worktrees: AITaskWorktree[]`. Add edit mode to `AITaskDetail.tsx` Task tab. Add attachment IPC handlers and UI.

**Tech Stack:** Electron IPC, React Context, TypeScript, fs module, git CLI, Radix UI + Tailwind.

**Reference:** [Design Document](./2026-03-08-edit-task-and-workspace-restructure-design.md)

---

## Task 1: Update Type Definitions

**Files:**
- Modify: `types.d.ts`

**Step 1: Add AITaskWorktree interface**

After the `AITask` interface (after line ~610), add:

```typescript
interface AITaskWorktree {
  projectPath: string
  worktreePath: string
  branchName: string
}
```

**Step 2: Update AITask interface**

In the `AITask` interface (~line 586):

Remove these fields:
```typescript
worktreeDir?: string
worktreePath?: string
maxReviewCycles: number
reviewCycleCount: number
```

Add this field (after `projectPaths`):
```typescript
worktrees: AITaskWorktree[]
```

**Step 3: Update AIAutomationSettings interface**

In the `AIAutomationSettings` interface (~line 643):

Remove:
```typescript
defaultMaxReviewCycles: number
defaultWorktreeDir: string
```

Add:
```typescript
taskDataRoot?: string
```

**Step 4: Update aiCreateTask IPC type**

Change the `aiCreateTask` entry in `EventPayloadMapping` (~line 1522):

From:
```typescript
aiCreateTask: {
  return: AITask;
  args: [string, string, AIGitStrategy, number, string[]?, string?, string?, string?];
}
```

To:
```typescript
aiCreateTask: {
  return: AITask;
  args: [string, string, AIGitStrategy, string[]?, string?, string?];
}
```

(Removed `number` for maxReviewCycles and last `string?` for worktreeDir)

**Step 5: Add attachment IPC types**

Add to `EventPayloadMapping`:

```typescript
aiAttachTaskFiles: {
  return: string[];
  args: [string, string[]];
}
aiDeleteTaskAttachment: {
  return: void;
  args: [string, string];
}
aiListTaskAttachments: {
  return: string[];
  args: [string];
}
```

**Step 6: Rename aiSelectWorktreeDir to aiSelectDirectory**

In `EventPayloadMapping`, rename `aiSelectWorktreeDir` to `aiSelectDirectory` (it's now used for both task data root and folder picking).

**Step 7: Update Window.electron interface**

Update the `aiCreateTask` signature:
```typescript
aiCreateTask: (title: string, description: string, gitStrategy: AIGitStrategy, projectPaths?: string[], baseBranch?: string, customBranchName?: string) => Promise<AITask>
```

Add:
```typescript
aiAttachTaskFiles: (taskId: string, filePaths: string[]) => Promise<string[]>
aiDeleteTaskAttachment: (taskId: string, filename: string) => Promise<void>
aiListTaskAttachments: (taskId: string) => Promise<string[]>
```

Rename `aiSelectWorktreeDir` to `aiSelectDirectory`.

**Step 8: Commit**

```bash
git add types.d.ts
git commit -m "refactor(ai): update types for workspace restructure and edit task"
```

---

## Task 2: Refactor Task Dir Manager

**Files:**
- Modify: `src/electron/ai-automation/task-dir-manager.ts`

**Step 1: Add settings-aware base directory**

Replace the hardcoded base with a function that reads `taskDataRoot` from settings:

```typescript
import path from 'path'
import fs from 'fs'
import { app } from 'electron'

const TASK_DATA_DIR = 'ai-task-data'

function getTaskDataBase(): string {
  // Dynamic import to avoid circular dependency — settings may not be ready at module load
  let taskDataRoot: string | undefined
  try {
    const { store } = require('../storage/store.cjs') as { store: { get: (key: string) => unknown } }
    const settings = store.get('aiAutomationSettings') as { taskDataRoot?: string } | undefined
    taskDataRoot = settings?.taskDataRoot
  } catch {
    // Store not ready yet
  }
  const base = taskDataRoot || path.join(app.getPath('userData'), TASK_DATA_DIR)
  if (!fs.existsSync(base)) {
    fs.mkdirSync(base, { recursive: true })
  }
  return base
}
```

Note: Since `task-dir-manager.ts` may be imported before the store is fully initialized, we use a try/catch around the store access. If the store isn't ready, we fall back to the default path. This only happens during very early startup.

Actually, a cleaner approach — pass the base path as a parameter or read from store directly since store is always available before task operations:

```typescript
import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { store } from '../storage/store.js'

const TASK_DATA_DIR = 'ai-task-data'

function getTaskDataBase(): string {
  const settings = store.get('aiAutomationSettings')
  const base = settings.taskDataRoot || path.join(app.getPath('userData'), TASK_DATA_DIR)
  if (!fs.existsSync(base)) {
    fs.mkdirSync(base, { recursive: true })
  }
  return base
}
```

**Step 2: Add subdirectory helpers**

```typescript
export function getAgentDir(taskId: string): string {
  const dir = path.join(getOrCreateTaskDir(taskId), 'agent')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function getAttachmentsDir(taskId: string): string {
  const dir = path.join(getOrCreateTaskDir(taskId), 'attachments')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function getWorktreesDir(taskId: string): string {
  const dir = path.join(getOrCreateTaskDir(taskId), 'worktrees')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}
```

**Step 3: Update listTaskDirFiles and readTaskDirFile to use agent/ subdirectory**

```typescript
export function listTaskDirFiles(taskId: string): string[] {
  const agentDir = path.join(getOrCreateTaskDir(taskId), 'agent')
  if (!fs.existsSync(agentDir)) return []
  return fs.readdirSync(agentDir).filter(f => {
    const stat = fs.statSync(path.join(agentDir, f))
    return stat.isFile()
  })
}

export function readTaskDirFile(taskId: string, filename: string): string {
  const filePath = path.join(getOrCreateTaskDir(taskId), 'agent', filename)
  if (!fs.existsSync(filePath)) return ''
  return fs.readFileSync(filePath, 'utf-8')
}
```

**Step 4: Add attachment functions**

```typescript
export function attachFiles(taskId: string, filePaths: string[]): string[] {
  const attachDir = getAttachmentsDir(taskId)
  const filenames: string[] = []
  for (const filePath of filePaths) {
    const filename = path.basename(filePath)
    const dest = path.join(attachDir, filename)
    fs.copyFileSync(filePath, dest)
    filenames.push(filename)
  }
  return filenames
}

export function deleteAttachment(taskId: string, filename: string): void {
  const filePath = path.join(getAttachmentsDir(taskId), filename)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

export function listAttachments(taskId: string): string[] {
  const attachDir = path.join(getOrCreateTaskDir(taskId), 'attachments')
  if (!fs.existsSync(attachDir)) return []
  return fs.readdirSync(attachDir).filter(f => {
    const stat = fs.statSync(path.join(attachDir, f))
    return stat.isFile()
  })
}
```

**Step 5: Add migration helper for existing task directories**

```typescript
export function migrateTaskDirStructure(taskId: string): void {
  const taskDir = getOrCreateTaskDir(taskId)
  const agentDir = path.join(taskDir, 'agent')

  // If agent/ already exists, skip migration
  if (fs.existsSync(agentDir)) return

  fs.mkdirSync(agentDir, { recursive: true })

  // Move loose files from root to agent/
  const entries = fs.readdirSync(taskDir)
  for (const entry of entries) {
    const fullPath = path.join(taskDir, entry)
    const stat = fs.statSync(fullPath)
    if (stat.isFile()) {
      fs.renameSync(fullPath, path.join(agentDir, entry))
    }
  }
}
```

**Step 6: Commit**

```bash
git add src/electron/ai-automation/task-dir-manager.ts
git commit -m "refactor(ai): restructure task directories with agent/attachments/worktrees subdirs"
```

---

## Task 3: Update Worktree Manager

**Files:**
- Modify: `src/electron/ai-automation/worktree-manager.ts`

**Step 1: Remove standalone worktrees base directory**

Remove `WORKTREES_DIR` constant and `getWorktreesBase()` function. Import `getWorktreesDir` from `task-dir-manager.js`.

**Step 2: Update createWorktree signature**

Change from:
```typescript
export function createWorktree(projectPath: string, branchName: string, baseBranch?: string, worktreeDir?: string): string
```

To:
```typescript
export function createWorktree(taskId: string, projectPath: string, branchName: string, baseBranch?: string): string
```

**Step 3: Update createWorktree body**

Replace worktree path logic:

```typescript
import { getWorktreesDir } from './task-dir-manager.js'

export function createWorktree(taskId: string, projectPath: string, branchName: string, baseBranch?: string): string {
  const worktreesBase = getWorktreesDir(taskId)
  // Use repo folder name for the worktree directory name
  const repoName = path.basename(projectPath)
  const worktreePath = path.join(worktreesBase, repoName)

  if (fs.existsSync(worktreePath)) {
    return worktreePath
  }

  const base = resolveBaseBranch(projectPath, baseBranch)

  try {
    git(['worktree', 'add', '-b', branchName, worktreePath, base], projectPath)
  } catch {
    try {
      git(['worktree', 'add', worktreePath, branchName], projectPath)
    } catch (err) {
      console.error(`[worktree] Failed to create worktree for ${branchName}:`, err)
      throw err
    }
  }

  return worktreePath
}
```

**Step 4: Commit**

```bash
git add src/electron/ai-automation/worktree-manager.ts
git commit -m "refactor(ai): worktrees now created inside task directory"
```

---

## Task 4: Update Task Manager

**Files:**
- Modify: `src/electron/ai-automation/task-manager.ts`

**Step 1: Update createTask signature and body**

Remove `maxReviewCycles` and `worktreeDir` parameters:

```typescript
export function createTask(
  title: string,
  description: string,
  gitStrategy: AIGitStrategy,
  projectPaths?: string[],
  baseBranch?: string,
  customBranchName?: string
): AITask {
  const now = new Date().toISOString()
  const id = randomUUID()
  const taskDir = getOrCreateTaskDir(id)
  const task: AITask = {
    id,
    title,
    description,
    phase: 'BACKLOG',
    createdAt: now,
    updatedAt: now,
    gitStrategy,
    baseBranch: baseBranch || undefined,
    customBranchName: customBranchName || undefined,
    projectPaths: projectPaths?.length ? projectPaths : undefined,
    worktrees: [],
    taskDirPath: taskDir,
    needsUserInput: false,
    phaseHistory: [{ phase: 'BACKLOG', enteredAt: now }]
  }

  const tasks = store.get('aiTasks')
  tasks.push(task)
  store.set('aiTasks', tasks)
  broadcastTasks()
  return task
}
```

**Step 2: Update deleteTask to clean up multiple worktrees**

```typescript
export function deleteTask(id: string) {
  const task = store.get('aiTasks').find(t => t.id === id)
  // Cleanup worktrees
  if (task?.worktrees) {
    for (const wt of task.worktrees) {
      try {
        cleanupWorktree(wt.projectPath, wt.worktreePath)
      } catch {
        // Best effort cleanup
      }
    }
  }
  // Legacy: cleanup single worktree if still present
  if ((task as any)?.worktreePath && task?.projectPaths?.[0]) {
    try {
      cleanupWorktree(task.projectPaths[0], (task as any).worktreePath)
    } catch {
      // Best effort cleanup
    }
  }
  cleanupTaskDir(id)
  const tasks = store.get('aiTasks').filter(t => t.id !== id)
  store.set('aiTasks', tasks)
  broadcastTasks()
}
```

**Step 3: Add workspace migration function**

Add to the migration section:

```typescript
import { migrateTaskDirStructure } from './task-dir-manager.js'

export function migrateTaskWorkspaces() {
  const tasks = store.get('aiTasks')
  const settings = store.get('aiAutomationSettings') as Record<string, unknown>
  let changed = false

  for (const task of tasks) {
    // Migrate directory structure (move loose files to agent/)
    migrateTaskDirStructure(task.id)

    // Convert worktreePath to worktrees array
    if ((task as any).worktreePath && !task.worktrees) {
      const worktreePath = (task as any).worktreePath as string
      const projectPath = task.projectPaths?.[0] || ''
      const branchName = task.branchName || ''
      task.worktrees = [{ projectPath, worktreePath, branchName }]
      delete (task as any).worktreePath
      delete (task as any).worktreeDir
      changed = true
    }

    // Ensure worktrees array exists
    if (!task.worktrees) {
      task.worktrees = []
      changed = true
    }

    // Remove deprecated fields
    if ('maxReviewCycles' in task || 'reviewCycleCount' in task) {
      delete (task as any).maxReviewCycles
      delete (task as any).reviewCycleCount
      changed = true
    }
  }

  // Remove deprecated settings fields
  if ('defaultMaxReviewCycles' in settings || 'defaultWorktreeDir' in settings) {
    delete (settings as any).defaultMaxReviewCycles
    delete (settings as any).defaultWorktreeDir
    store.set('aiAutomationSettings', settings as AIAutomationSettings)
  }

  if (changed) {
    store.set('aiTasks', tasks)
  }
}
```

**Step 4: Commit**

```bash
git add src/electron/ai-automation/task-manager.ts
git commit -m "refactor(ai): update task manager for workspace restructure and migration"
```

---

## Task 5: Update Agent Runner

**Files:**
- Modify: `src/electron/ai-automation/agent-runner.ts`

**Step 1: Update worktree creation in spawnAgent**

Replace the worktree creation block (~line 231-243) with:

```typescript
// Create worktree on first agent phase if needed
if (task.worktrees.length === 0 && task.projectPaths?.[0] && task.gitStrategy !== 'none') {
  const branchName = task.customBranchName || generateBranchName(taskId, task.title)
  const baseBranch = task.baseBranch || settings.defaultBaseBranch || undefined
  try {
    const worktreePath = createWorktree(taskId, task.projectPaths[0], branchName, baseBranch)
    const worktree: AITaskWorktree = { projectPath: task.projectPaths[0], worktreePath, branchName }
    updateTask(taskId, { branchName, worktrees: [worktree] })
    task = getTaskById(taskId)!
    emit(taskId, `\n📁 Created worktree: ${worktreePath} (branch: ${branchName} from ${baseBranch || 'auto'})\n`)
  } catch (err) {
    emit(taskId, `\n⚠️ Git setup failed: ${(err as Error).message}. Agent will use project directory.\n`)
  }
}
```

**Step 2: Update createWorktree import**

The `createWorktree` call now takes `taskId` as the first argument. Update the import — no change needed since we're importing the same function, just the signature changed.

**Step 3: Update cwd resolution**

Replace the cwd block (~line 289-294) with:

```typescript
let cwd: string
if (task.worktrees.length > 0) {
  cwd = task.worktrees[0].worktreePath
} else {
  cwd = task.projectPaths?.[0] || process.cwd()
}
```

**Step 4: Commit**

```bash
git add src/electron/ai-automation/agent-runner.ts
git commit -m "refactor(ai): agent runner uses worktrees array and task-scoped worktree creation"
```

---

## Task 6: Update Prompt Builder

**Files:**
- Modify: `src/electron/ai-automation/prompt-builder.ts`

**Step 1: Update working directory reference**

Replace the task context block that references `task.worktreePath` with:

```typescript
let taskContext = `## Task\n\n**Title:** ${task.title}\n\n**Description:** ${task.description}`
if (task.projectPaths && task.projectPaths.length > 0) {
  const workingDir = task.worktrees.length > 0 ? task.worktrees[0].worktreePath : task.projectPaths[0]
  taskContext += `\n\n**Working Directory:** ${workingDir}\n\nIMPORTANT: All file reads, writes, and modifications MUST use paths within ${workingDir}. Do NOT access or modify files in any other directory.`
  if (task.worktrees.length > 0) {
    taskContext += `\n\nThis is a git worktree. The original project is at ${task.projectPaths[0]} — do NOT modify files there.`
  }
  if (task.projectPaths.length > 1) {
    taskContext += `\nYou also have access to: ${task.projectPaths.slice(1).join(', ')}`
  }
}
parts.push(taskContext)
```

**Step 2: Add attachments context**

After the task directory context section, add:

```typescript
// 5b. User attachments
import { listAttachments } from './task-dir-manager.js'

const attachments = listAttachments(task.id)
if (attachments.length > 0) {
  let attachContext = `## User Attachments\n\nThe user has attached these files to the task:\n`
  const attachDir = path.join(task.taskDirPath || '', 'attachments')
  for (const file of attachments) {
    attachContext += `- ${file}\n`
    try {
      const content = fs.readFileSync(path.join(attachDir, file), 'utf-8')
      if (content.length < 10000) {
        attachContext += `\n\`\`\`\n${content}\n\`\`\`\n`
      } else {
        attachContext += `\n\`\`\`\n${content.slice(0, 5000)}\n...(truncated, ${content.length} chars total)\n\`\`\`\n`
      }
    } catch {
      attachContext += `  (binary or unreadable)\n`
    }
  }
  parts.push(attachContext)
}
```

Add necessary imports at the top:

```typescript
import { listTaskDirFiles, readTaskDirFile, listAttachments, getAttachmentsDir } from './task-dir-manager.js'
import fs from 'fs'
```

**Step 3: Commit**

```bash
git add src/electron/ai-automation/prompt-builder.ts
git commit -m "refactor(ai): prompt builder uses worktrees array and includes attachments"
```

---

## Task 7: Update Store Schema

**Files:**
- Modify: `src/electron/storage/store.ts`

**Step 1: Update defaults**

In the `aiAutomationSettings` defaults, remove `defaultMaxReviewCycles` and `defaultWorktreeDir`, and leave `taskDataRoot` unset (undefined defaults to app data):

```typescript
aiAutomationSettings: {
  maxConcurrency: 1,
  defaultGitStrategy: 'worktree' as AIGitStrategy,
  defaultBaseBranch: 'main',
  pipeline: DEFAULT_PIPELINE,
  phasePrompts: {
    planning: '',
    working: '',
    reviewing: ''
  },
  globalRules: '',
  knowledgeDocs: []
}
```

**Step 2: Commit**

```bash
git add src/electron/storage/store.ts
git commit -m "refactor(ai): remove deprecated settings defaults"
```

---

## Task 8: Update IPC Handlers and Preload

**Files:**
- Modify: `src/electron/main.ts`
- Modify: `src/electron/preload.cts`

**Step 1: Update main.ts imports**

Add imports for new task-dir-manager functions:

```typescript
import { listTaskDirFiles, readTaskDirFile, attachFiles, deleteAttachment, listAttachments } from './ai-automation/task-dir-manager.js'
```

Add import for `migrateTaskWorkspaces`:

```typescript
import { ..., migrateTaskWorkspaces } from './ai-automation/task-manager.js'
```

**Step 2: Update aiCreateTask handler**

Remove `maxReviewCycles` and `worktreeDir` parameters:

```typescript
ipcMainHandle('aiCreateTask', async (_event, title, description, gitStrategy, projectPaths, baseBranch, customBranchName) => {
  return aiCreateTask(title, description, gitStrategy, projectPaths, baseBranch, customBranchName)
})
```

**Step 3: Rename aiSelectWorktreeDir to aiSelectDirectory**

```typescript
ipcMainHandle('aiSelectDirectory', async () => {
  const { dialog } = await import('electron')
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Directory'
  })
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]
  }
  return null
})
```

**Step 4: Add attachment handlers**

```typescript
ipcMainHandle('aiAttachTaskFiles', async (_event, taskId, filePaths) => {
  return attachFiles(taskId, filePaths)
})

ipcMainHandle('aiDeleteTaskAttachment', async (_event, taskId, filename) => {
  deleteAttachment(taskId, filename)
})

ipcMainHandle('aiListTaskAttachments', async (_event, taskId) => {
  return listAttachments(taskId)
})
```

**Step 5: Update aiRemoveWorktree handler**

Update to work with the worktrees array:

```typescript
ipcMainHandle('aiRemoveWorktree', async (_event, taskId) => {
  const task = getTasks().find(t => t.id === taskId)
  if (!task?.worktrees?.length) return
  for (const wt of task.worktrees) {
    cleanupWorktree(wt.projectPath, wt.worktreePath)
  }
  aiUpdateTask(taskId, { worktrees: [] })
})
```

**Step 6: Add migration call on startup**

After existing migration calls, add:

```typescript
migrateTaskWorkspaces()
```

**Step 7: Update preload.cts**

Update `aiCreateTask`:
```typescript
aiCreateTask: (title: string, description: string, gitStrategy: AIGitStrategy, projectPaths?: string[], baseBranch?: string, customBranchName?: string) =>
  ipcInvoke('aiCreateTask', title, description, gitStrategy, projectPaths, baseBranch, customBranchName),
```

Rename `aiSelectWorktreeDir` to `aiSelectDirectory`:
```typescript
aiSelectDirectory: () => ipcInvoke('aiSelectDirectory'),
```

Add attachment methods:
```typescript
aiAttachTaskFiles: (taskId: string, filePaths: string[]) => ipcInvoke('aiAttachTaskFiles', taskId, filePaths),
aiDeleteTaskAttachment: (taskId: string, filename: string) => ipcInvoke('aiDeleteTaskAttachment', taskId, filename),
aiListTaskAttachments: (taskId: string) => ipcInvoke('aiListTaskAttachments', taskId),
```

**Step 8: Commit**

```bash
git add src/electron/main.ts src/electron/preload.cts
git commit -m "refactor(ai): update IPC handlers for workspace restructure and attachments"
```

---

## Task 9: Update React Context

**Files:**
- Modify: `src/ui/contexts/ai-automation.tsx`

**Step 1: Update createTask signature**

Remove `maxReviewCycles` and `worktreeDir` from the context type and implementation:

In the interface:
```typescript
createTask: (title: string, description: string, gitStrategy: AIGitStrategy, projectPaths?: string[], baseBranch?: string, customBranchName?: string) => Promise<AITask>
```

In the implementation:
```typescript
const createTask = useCallback(async (title: string, description: string, gitStrategy: AIGitStrategy, projectPaths?: string[], baseBranch?: string, customBranchName?: string) => {
  return window.electron.aiCreateTask(title, description, gitStrategy, projectPaths, baseBranch, customBranchName)
}, [])
```

**Step 2: Commit**

```bash
git add src/ui/contexts/ai-automation.tsx
git commit -m "refactor(ai): update context for simplified createTask signature"
```

---

## Task 10: Update NewTaskDialog

**Files:**
- Modify: `src/ui/components/ai-automation/NewTaskDialog.tsx`

**Step 1: Remove deprecated state and UI**

Remove these state variables:
- `maxReviewCycles`
- `worktreeDir`

Remove from the `useEffect` that syncs defaults:
- `setMaxReviewCycles(settings.defaultMaxReviewCycles)`
- `setWorktreeDir(settings.defaultWorktreeDir)`

**Step 2: Remove maxReviewCycles from the flex row**

The flex row with Git Strategy and Max Review Cycles (~line 231-255): remove the Max Review Cycles div. Git Strategy can stand alone.

**Step 3: Remove Worktree Directory input**

Remove the entire "Worktree Directory" section inside the `gitStrategy === 'worktree'` conditional (~line 278-299).

**Step 4: Update handleCreate**

```typescript
const handleCreate = async () => {
  if (!title.trim()) return
  const projectPaths = taggedProjects.map(p => p.path)
  const branch = gitStrategy === 'worktree' ? baseBranch.trim() || undefined : undefined
  const branchName = gitStrategy === 'worktree' ? customBranchName.trim() || undefined : undefined
  await createTask(title.trim(), description.trim(), gitStrategy, projectPaths.length > 0 ? projectPaths : undefined, branch, branchName)
  setTitle('')
  setDescription('')
  setCustomBranchName('')
  setTaggedProjects([])
  onOpenChange(false)
}
```

**Step 5: Update any references to aiSelectWorktreeDir**

If there are any remaining references to `aiSelectWorktreeDir`, rename to `aiSelectDirectory`.

**Step 6: Commit**

```bash
git add src/ui/components/ai-automation/NewTaskDialog.tsx
git commit -m "refactor(ai): simplify new task dialog, remove deprecated fields"
```

---

## Task 11: Update Settings UI

**Files:**
- Modify: `src/ui/views/AISettings.tsx`

**Step 1: Update GeneralTab**

Remove "Default Worktree Directory" section and "Default Max Review Cycles" section.

Add "Task Data Directory" section:

```tsx
<div>
  <Label>Task Data Directory</Label>
  <p className="text-xs text-neutral-500 mb-1">Where task workspaces are stored (agent files, attachments, worktrees). Changing this only affects new tasks.</p>
  <div className="flex gap-2">
    <Input
      value={settings.taskDataRoot || ''}
      onChange={e => updateSettings({ taskDataRoot: e.target.value || undefined })}
      placeholder={`Default (app data directory)`}
      className="w-64"
    />
    <Button
      variant="outline"
      size="sm"
      className="px-3 shrink-0"
      onClick={async () => {
        const selected = await window.electron.aiSelectDirectory()
        if (selected) updateSettings({ taskDataRoot: selected })
      }}
    >
      <Folder className="h-4 w-4" />
    </Button>
  </div>
</div>
```

**Step 2: Update any other references to aiSelectWorktreeDir**

In the KnowledgeDocsTab, update the folder picker:
```typescript
const selected = await window.electron.aiSelectDirectory()
```

**Step 3: Commit**

```bash
git add src/ui/views/AISettings.tsx
git commit -m "refactor(ai): update settings UI for task data root, remove deprecated fields"
```

---

## Task 12: Add Edit Mode to Task Detail

**Files:**
- Modify: `src/ui/views/AITaskDetail.tsx`

**Step 1: Add edit state**

Inside `AITaskDetail` component, add:

```typescript
const [editing, setEditing] = useState(false)
const [editTitle, setEditTitle] = useState('')
const [editDescription, setEditDescription] = useState('')
const [editGitStrategy, setEditGitStrategy] = useState<AIGitStrategy>('worktree')
const [editBaseBranch, setEditBaseBranch] = useState('')
const [editProjectPaths, setEditProjectPaths] = useState<string[]>([])

const canEdit = task?.phase === 'BACKLOG'

const startEditing = () => {
  if (!task) return
  setEditTitle(task.title)
  setEditDescription(task.description)
  setEditGitStrategy(task.gitStrategy)
  setEditBaseBranch(task.baseBranch || '')
  setEditProjectPaths(task.projectPaths || [])
  setEditing(true)
}

const saveEdit = async () => {
  await updateTask(task!.id, {
    title: editTitle.trim(),
    description: editDescription.trim(),
    gitStrategy: editGitStrategy,
    baseBranch: editBaseBranch.trim() || undefined,
    projectPaths: editProjectPaths.length > 0 ? editProjectPaths : undefined
  })
  setEditing(false)
}

const cancelEdit = () => {
  setEditing(false)
}
```

**Step 2: Add Edit button to header**

In the header bar, after the back button and title area, and before the action buttons:

```tsx
{canEdit && !editing && (
  <Button variant="outline" size="sm" onClick={startEditing}>
    <Pencil className="h-3 w-3 mr-1" />
    Edit
  </Button>
)}
{editing && (
  <div className="flex gap-2">
    <Button variant="ghost" size="sm" onClick={cancelEdit}>Cancel</Button>
    <Button size="sm" onClick={saveEdit}>Save</Button>
  </div>
)}
```

Add `Pencil` to the lucide-react imports.

**Step 3: Update the Task tab content**

Replace the read-only Task tab content with a conditional that shows inputs when editing:

```tsx
<TabsContent value="task" className="flex-1 min-h-0 overflow-y-auto p-4">
  <div className="space-y-4 max-w-2xl">
    <div>
      <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Title</h3>
      {editing ? (
        <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="mt-1" />
      ) : (
        <p className="mt-1 text-sm text-white">{task.title}</p>
      )}
    </div>
    <div>
      <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Description</h3>
      {editing ? (
        <Textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={6} className="mt-1" />
      ) : (
        task.description && <p className="mt-1 text-sm text-neutral-300 whitespace-pre-wrap">{task.description}</p>
      )}
    </div>
    {/* Projects section */}
    <div>
      <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Projects</h3>
      {editing ? (
        <div className="mt-1 space-y-2">
          {editProjectPaths.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-sm text-neutral-300 flex-1 truncate">{p}</span>
              <Button variant="ghost" size="sm" onClick={() => setEditProjectPaths(prev => prev.filter((_, j) => j !== i))}>
                <X className="h-3 w-3 text-red-400" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={async () => {
            const selected = await window.electron.aiSelectDirectory()
            if (selected && !editProjectPaths.includes(selected)) {
              setEditProjectPaths(prev => [...prev, selected])
            }
          }}>
            <Plus className="h-3 w-3 mr-1" /> Add Project
          </Button>
        </div>
      ) : (
        task.projectPaths && task.projectPaths.length > 0 && (
          <div className="mt-1 space-y-1">
            {task.projectPaths.map(p => (
              <div key={p} className="flex items-center gap-2 text-sm text-neutral-300">
                <FolderOpen className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                <span className="font-medium">{p.split('/').pop()}</span>
                <span className="text-xs text-neutral-500">{p}</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
    {/* Git strategy and base branch */}
    <div className="flex gap-6">
      <div>
        <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Git Strategy</h3>
        {editing ? (
          <Select value={editGitStrategy} onValueChange={(v) => setEditGitStrategy(v as AIGitStrategy)}>
            <SelectTrigger className="mt-1 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="worktree">Worktree</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <p className="mt-1 text-sm text-neutral-300">{task.gitStrategy}</p>
        )}
      </div>
      {(editing ? editGitStrategy === 'worktree' : task.gitStrategy === 'worktree') && (
        <div>
          <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Base Branch</h3>
          {editing ? (
            <Input value={editBaseBranch} onChange={e => setEditBaseBranch(e.target.value)} placeholder="main" className="mt-1 w-32" />
          ) : (
            <p className="mt-1 text-sm text-neutral-300">{task.baseBranch || 'auto'}</p>
          )}
        </div>
      )}
    </div>
    {/* Non-editable info (always shown) */}
    {task.worktrees && task.worktrees.length > 0 && (
      <div>
        <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Worktrees</h3>
        {task.worktrees.map((wt, i) => (
          <div key={i} className="mt-1 flex items-center gap-2">
            <GitBranch className="h-3.5 w-3.5 text-neutral-500 flex-shrink-0" />
            <span className="text-sm text-neutral-300 font-mono truncate">{wt.worktreePath}</span>
            <span className="text-xs text-neutral-500">({wt.branchName})</span>
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 h-6 px-2 text-red-400 hover:text-red-300 hover:bg-red-900/20"
          disabled={isAgentRunning}
          onClick={async () => {
            if (confirm('Remove all worktrees? The branches will be kept.')) {
              await window.electron.aiRemoveWorktree(task.id)
            }
          }}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Remove Worktrees
        </Button>
      </div>
    )}
    {/* Previous review comments */}
    {task.humanComments && task.humanComments.length > 0 && !isManualPhase && (
      <div>
        <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Previous Review Comments</h3>
        <div className="mt-1 space-y-1">
          {task.humanComments.map((c, i) => (
            <div key={i} className="flex items-start gap-2 text-sm p-2 rounded bg-amber-900/10 border border-amber-900/20">
              <MessageSquare className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <span className="text-xs text-neutral-500 font-mono">{c.file}:{c.line}</span>
                <p className="text-xs text-neutral-300 mt-0.5">{c.comment}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
    <div>
      <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Created</h3>
      <p className="mt-1 text-sm text-neutral-300">{new Date(task.createdAt).toLocaleString()}</p>
    </div>
  </div>
</TabsContent>
```

Add necessary imports: `Pencil`, `Plus`, `X` from lucide-react, `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`, `Input`, `Textarea`.

**Step 4: Commit**

```bash
git add src/ui/views/AITaskDetail.tsx
git commit -m "feat(ai): add edit mode for tasks in BACKLOG phase"
```

---

## Task 13: Add File Attachments UI

**Files:**
- Modify: `src/ui/views/AITaskDetail.tsx`

**Step 1: Update TaskFilesTab to show both sections**

Replace the `TaskFilesTab` component:

```tsx
const TaskFilesTab: FC<{ taskId: string }> = ({ taskId }) => {
  const [agentFiles, setAgentFiles] = useState<string[]>([])
  const [attachments, setAttachments] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState<{ name: string; type: 'agent' | 'attachment' } | null>(null)
  const [content, setContent] = useState('')

  const loadFiles = () => {
    window.electron.aiGetTaskFiles(taskId).then(setAgentFiles)
    window.electron.aiListTaskAttachments(taskId).then(setAttachments)
  }

  useEffect(() => { loadFiles() }, [taskId])

  useEffect(() => {
    if (selectedFile) {
      if (selectedFile.type === 'agent') {
        window.electron.aiReadTaskFile(taskId, selectedFile.name).then(setContent)
      } else {
        // For attachments, read via the same mechanism or a dedicated handler
        // For now, just show the filename since attachments may be binary
        setContent('(Attachment — view in file manager)')
      }
    }
  }, [taskId, selectedFile])

  const handleAttach = async () => {
    const { dialog } = window.electron as any
    // Use the select directory handler repurposed for files
    const filePaths = await window.electron.aiAttachTaskFiles(taskId, [])
    // Actually, we need a file picker. Let's use a dedicated approach:
    // The attach button should call a file picker IPC, then attach.
    // For now, use the existing dialog pattern:
  }

  return (
    <div className="space-y-4">
      {/* Attachments section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Attachments</h3>
          <Button variant="outline" size="sm" onClick={async () => {
            // Open native file picker via IPC — we'll need aiSelectFiles
            // For now, use aiAttachTaskFiles with a file dialog
            const selected = await window.electron.aiSelectFiles()
            if (selected && selected.length > 0) {
              await window.electron.aiAttachTaskFiles(taskId, selected)
              loadFiles()
            }
          }}>
            <Paperclip className="h-3 w-3 mr-1" /> Attach Files
          </Button>
        </div>
        {attachments.length === 0 ? (
          <p className="text-neutral-600 text-xs">No attachments. Click "Attach Files" to add reference files for agents.</p>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {attachments.map(f => (
              <div key={f} className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-xs text-neutral-300">
                <Paperclip className="h-3 w-3 text-neutral-500" />
                {f}
                <button
                  onClick={async () => {
                    await window.electron.aiDeleteTaskAttachment(taskId, f)
                    loadFiles()
                  }}
                  className="ml-1 text-red-400 hover:text-red-300"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agent files section */}
      <div>
        <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Agent Files</h3>
        {agentFiles.length === 0 ? (
          <p className="text-neutral-600 text-xs">No agent files yet — agents will create files here during execution.</p>
        ) : (
          <>
            <div className="flex gap-2 flex-wrap">
              {agentFiles.map(f => (
                <Button
                  key={f}
                  variant={selectedFile?.name === f && selectedFile?.type === 'agent' ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs"
                  onClick={() => setSelectedFile({ name: f, type: 'agent' })}
                >
                  {f}
                </Button>
              ))}
            </div>
            {selectedFile?.type === 'agent' && (
              <pre className="mt-3 whitespace-pre-wrap text-sm text-neutral-300 font-mono bg-neutral-900 p-4 rounded border border-neutral-800 max-h-[500px] overflow-y-auto">
                {content || 'Empty file'}
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

Wait — we need a file picker IPC that returns file paths (not a directory picker). Let me add that.

**Step 2: Add aiSelectFiles IPC**

In `types.d.ts`, add to `EventPayloadMapping`:
```typescript
aiSelectFiles: {
  return: string[] | null;
  args: [];
}
```

In `Window.electron`:
```typescript
aiSelectFiles: () => Promise<string[] | null>
```

In `main.ts`:
```typescript
ipcMainHandle('aiSelectFiles', async () => {
  const { dialog } = await import('electron')
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    title: 'Select Files to Attach'
  })
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths
  }
  return null
})
```

In `preload.cts`:
```typescript
aiSelectFiles: () => ipcInvoke('aiSelectFiles'),
```

Add `Paperclip` to lucide-react imports in `AITaskDetail.tsx`.

**Step 3: Commit**

```bash
git add src/ui/views/AITaskDetail.tsx src/electron/main.ts src/electron/preload.cts types.d.ts
git commit -m "feat(ai): add file attachments UI with attach, view, and delete"
```

---

## Task 14: Verify Build and Test

**Step 1: Run TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run dev server**

Run: `npm run dev`
Expected: App starts without errors

**Step 3: Manual verification checklist**

- [ ] Create a new task — no maxReviewCycles or worktreeDir fields in dialog
- [ ] Task appears in BACKLOG
- [ ] Open task detail, verify "Edit" button appears
- [ ] Click Edit, modify title and description, save — changes persist
- [ ] Cancel edit — changes discarded
- [ ] Task Files tab shows "Attachments" and "Agent Files" sections
- [ ] Attach a file — file appears in attachments list
- [ ] Delete an attachment — file removed
- [ ] Settings > General shows "Task Data Directory" instead of old fields
- [ ] Move task to first pipeline phase — worktree created in task data directory
- [ ] Existing tasks (if any) migrated properly

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(ai): address build/test issues from workspace restructure"
```

---

## Summary of All Changes

| File | Action | What |
|------|--------|------|
| `types.d.ts` | Modify | Add AITaskWorktree, update AITask, AIAutomationSettings, IPC types |
| `task-dir-manager.ts` | Modify | Add subdirectory helpers, attachments, migration |
| `worktree-manager.ts` | Modify | Worktrees inside task dir, takes taskId |
| `task-manager.ts` | Modify | Simplified createTask, migration, delete with worktrees array |
| `agent-runner.ts` | Modify | Use worktrees array, pass taskId to createWorktree |
| `prompt-builder.ts` | Modify | Use worktrees array, include attachments in prompt |
| `store.ts` | Modify | Remove deprecated defaults |
| `main.ts` | Modify | Update handlers, add attachment handlers, add migration call |
| `preload.cts` | Modify | Update signatures, add attachment methods |
| `ai-automation.tsx` | Modify | Simplified createTask signature |
| `NewTaskDialog.tsx` | Modify | Remove maxReviewCycles, worktreeDir |
| `AISettings.tsx` | Modify | Task data root setting, remove deprecated settings |
| `AITaskDetail.tsx` | Modify | Edit mode, attachments UI, worktrees array display |
