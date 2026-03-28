# Customizable Pipeline Phases — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hardcoded AI automation phases with a user-configurable ordered pipeline of phases, each either an AI agent step or a manual human step.

**Architecture:** Pipeline phases are stored as an ordered array in settings. The agent runner reads the phase config to determine what to spawn and where to route on completion. A per-task workspace directory replaces the special `plan` field. Fixed BACKLOG/DONE endpoints bookend the customizable phases.

**Tech Stack:** Electron IPC, React Context, TypeScript, Claude Code CLI, Radix UI + Tailwind.

**Design Doc:** [docs/plans/2026-03-07-customizable-pipeline-design.md](./2026-03-07-customizable-pipeline-design.md)

---

## Task 1: Update Type Definitions

**Files:**
- Modify: `types.d.ts`

**Step 1: Add AIPipelinePhase interface and update types**

Add after the `AIGitStrategy` type (~line 575):

```typescript
interface AIPipelinePhase {
  id: string
  name: string
  type: 'agent' | 'manual'
  prompt?: string
  allowedTools?: string
  rejectPattern?: string
  rejectTarget?: string
}
```

Change `AITaskPhase` to:
```typescript
type AITaskPhase = 'BACKLOG' | 'DONE' | string
```

Remove `AIAgentRole` type entirely.

In `AITask` interface:
- Change `phase: AITaskPhase` → stays as-is (type is now broader)
- Remove `currentAgentRole?: AIAgentRole`
- Add `currentPhaseName?: string` (display name of active phase)
- Add `taskDirPath?: string`
- Keep `plan?: string` for backwards compat (deprecated)

In `AIAutomationSettings`:
- Add `pipeline: AIPipelinePhase[]`
- Keep `phasePrompts` for migration but it will be ignored by runtime
- Keep `defaultMaxReviewCycles` for migration

In `AIPhaseHistoryEntry`:
- `phase: AITaskPhase` stays (now accepts any string)

In `EventPayloadMapping`:
- `aiMoveTaskPhase` args: change `AITaskPhase` to `string`

In `Window.electron`:
- `aiMoveTaskPhase`: change parameter type from `AITaskPhase` to `string`

**Step 2: Verify compilation**

Run: `npx tsc -b --noEmit 2>&1 | grep -iE "ai-automation|AITask|AIAgent|Pipeline"`
Expected: No new errors from our changes (existing unrelated errors are fine)

**Step 3: Commit**

```bash
git add types.d.ts
git commit -m "refactor(ai): update types for customizable pipeline phases"
```

---

## Task 2: Add Default Pipeline & Migration to Store

**Files:**
- Modify: `src/electron/storage/store.ts`

**Step 1: Add default pipeline config**

Add before `export const store`:

```typescript
const DEFAULT_PIPELINE: AIPipelinePhase[] = [
  {
    id: 'planning',
    name: 'Planning',
    type: 'agent',
    prompt: `You are a planning agent. Your ONLY job is to produce an implementation plan. You must NOT implement, create, modify, or delete any files. Do NOT execute any code or make any changes. You are strictly a planner.

Your job:
1. Understand the task described below
2. Explore the relevant codebases to understand the current state (read-only)
3. Produce a detailed implementation plan

Save your plan to plan.md in the task directory provided via --add-dir. Be specific about:
- Which files need to be created or modified
- What changes need to be made in each file
- What the expected outcome is
- Any risks or considerations

IMPORTANT: Do NOT take any action. Do NOT create or modify project files. ONLY explore and write the plan.`,
    allowedTools: 'Read,Glob,Grep,Bash(find:*),Bash(ls:*),Bash(cat:*),Bash(git:*),Write',
  },
  {
    id: 'in-progress',
    name: 'In Progress',
    type: 'agent',
    prompt: `You are an implementation agent. Your job is to:
1. Read the plan from plan.md in the task directory
2. Implement the changes described in the plan
3. Create commits for your work
4. Ask for help if you get stuck

Work methodically through the plan step by step.`,
  },
  {
    id: 'agent-review',
    name: 'Agent Review',
    type: 'agent',
    prompt: `You are a code review agent. Your job is to:
1. Read the plan from plan.md in the task directory
2. Review the code changes against the plan and requirements
3. Check for bugs, security issues, and code quality
4. Provide specific, actionable feedback

Save your review to review.md in the task directory.

At the end of your review, you MUST output one of:
- REVIEW_DECISION: APPROVE — if the changes are acceptable
- REVIEW_DECISION: REJECT — if changes need work, followed by your comments`,
    allowedTools: 'Read,Glob,Grep,Bash(git:*),Bash(diff:*),Write',
    rejectPattern: 'REVIEW_DECISION: REJECT',
    rejectTarget: 'in-progress',
  },
  {
    id: 'human-review',
    name: 'Human Review',
    type: 'manual',
  },
]
```

Add `pipeline: DEFAULT_PIPELINE` to the `aiAutomationSettings` defaults.

**Step 2: Commit**

```bash
git add src/electron/storage/store.ts
git commit -m "feat(ai): add default pipeline config to store"
```

---

## Task 3: Create Task Directory Manager

**Files:**
- Create: `src/electron/ai-automation/task-dir-manager.ts`

**Step 1: Create the module**

```typescript
import path from 'path'
import fs from 'fs'
import { app } from 'electron'

const TASK_DATA_DIR = 'ai-task-data'

function getTaskDataBase(): string {
  const base = path.join(app.getPath('userData'), TASK_DATA_DIR)
  if (!fs.existsSync(base)) {
    fs.mkdirSync(base, { recursive: true })
  }
  return base
}

export function getOrCreateTaskDir(taskId: string): string {
  const taskDir = path.join(getTaskDataBase(), taskId)
  if (!fs.existsSync(taskDir)) {
    fs.mkdirSync(taskDir, { recursive: true })
  }
  return taskDir
}

export function cleanupTaskDir(taskId: string): void {
  const taskDir = path.join(getTaskDataBase(), taskId)
  try {
    if (fs.existsSync(taskDir)) {
      fs.rmSync(taskDir, { recursive: true, force: true })
    }
  } catch {
    // Best effort
  }
}

export function listTaskDirFiles(taskId: string): string[] {
  const taskDir = path.join(getTaskDataBase(), taskId)
  if (!fs.existsSync(taskDir)) return []
  return fs.readdirSync(taskDir).filter(f => {
    const stat = fs.statSync(path.join(taskDir, f))
    return stat.isFile()
  })
}

export function readTaskDirFile(taskId: string, filename: string): string {
  const filePath = path.join(getTaskDataBase(), taskId, filename)
  if (!fs.existsSync(filePath)) return ''
  return fs.readFileSync(filePath, 'utf-8')
}
```

**Step 2: Commit**

```bash
git add src/electron/ai-automation/task-dir-manager.ts
git commit -m "feat(ai): add task directory manager"
```

---

## Task 4: Refactor Task Manager for Dynamic Phases

**Files:**
- Modify: `src/electron/ai-automation/task-manager.ts`

**Step 1: Replace VALID_TRANSITIONS with dynamic validation**

Replace the `VALID_TRANSITIONS` constant and the `moveTaskPhase` function:

```typescript
import { cleanupTaskDir } from './task-dir-manager.js'

// Remove VALID_TRANSITIONS entirely

export function moveTaskPhase(id: string, targetPhase: string): AITask {
  const tasks = store.get('aiTasks')
  const index = tasks.findIndex(t => t.id === id)
  if (index === -1) throw new Error(`Task ${id} not found`)

  const task = tasks[index]
  const settings = getSettings()
  const pipeline = settings.pipeline || []

  // Validate transition
  const isValid = isValidTransition(task.phase, targetPhase, pipeline)
  if (!isValid) {
    throw new Error(`Cannot transition from ${task.phase} to ${targetPhase}`)
  }

  const now = new Date().toISOString()
  const history = [...task.phaseHistory]
  if (history.length > 0) {
    history[history.length - 1] = { ...history[history.length - 1], exitedAt: now }
  }
  history.push({ phase: targetPhase, enteredAt: now })

  // Look up display name for the phase
  const phaseConfig = pipeline.find(p => p.id === targetPhase)
  const currentPhaseName = phaseConfig?.name || targetPhase

  tasks[index] = {
    ...task,
    phase: targetPhase,
    updatedAt: now,
    phaseHistory: history,
    needsUserInput: false,
    currentPhaseName
  }
  store.set('aiTasks', tasks)
  broadcastTasks()
  return tasks[index]
}

function isValidTransition(from: string, to: string, pipeline: AIPipelinePhase[]): boolean {
  const phaseIds = pipeline.map(p => p.id)
  const allPhases = ['BACKLOG', ...phaseIds, 'DONE']
  const fromIndex = allPhases.indexOf(from)
  const toIndex = allPhases.indexOf(to)

  // BACKLOG can go to first pipeline phase
  if (from === 'BACKLOG' && toIndex === 1) return true
  // First pipeline phase can go back to BACKLOG
  if (to === 'BACKLOG' && fromIndex === 1) return true
  // Forward by one step
  if (toIndex === fromIndex + 1) return true
  // Reject routing: any pipeline phase can go to any other pipeline phase (for rejectTarget)
  if (from !== 'BACKLOG' && from !== 'DONE' && to !== 'BACKLOG' && to !== 'DONE') return true
  // Moving to DONE from any phase
  if (to === 'DONE' && from !== 'BACKLOG') return true

  return false
}
```

**Step 2: Update deleteTask to clean up task directory**

In `deleteTask`, add after worktree cleanup:

```typescript
cleanupTaskDir(id)
```

**Step 3: Update createTask to set taskDirPath**

Import `getOrCreateTaskDir` from task-dir-manager. In `createTask`, after creating the task object, add:

```typescript
const taskDir = getOrCreateTaskDir(task.id)
task.taskDirPath = taskDir
```

**Step 4: Commit**

```bash
git add src/electron/ai-automation/task-manager.ts
git commit -m "refactor(ai): dynamic phase transitions in task manager"
```

---

## Task 5: Refactor Prompt Builder for Generic Phases

**Files:**
- Modify: `src/electron/ai-automation/prompt-builder.ts`

**Step 1: Rewrite buildPrompt to be phase-config-driven**

Replace the entire file:

```typescript
import { getSettings } from './task-manager.js'
import { listTaskDirFiles, readTaskDirFile } from './task-dir-manager.js'

export function buildPrompt(task: AITask, phaseConfig: AIPipelinePhase): string {
  const settings = getSettings()
  const parts: string[] = []

  // 1. Global rules
  if (settings.globalRules.trim()) {
    parts.push(`## Global Rules\n\n${settings.globalRules}`)
  }

  // 2. Phase-specific prompt
  if (phaseConfig.prompt) {
    parts.push(`## Agent Instructions\n\n${phaseConfig.prompt}`)
  }

  // 3. Knowledge docs
  if (settings.knowledgeDocs.length > 0) {
    const docs = settings.knowledgeDocs.map(d => `### ${d.title}\n\n${d.content}`).join('\n\n')
    parts.push(`## Project Knowledge\n\n${docs}`)
  }

  // 4. Task context
  let taskContext = `## Task\n\n**Title:** ${task.title}\n\n**Description:** ${task.description}`
  if (task.projectPaths && task.projectPaths.length > 0) {
    const workingDir = task.worktreePath || task.projectPaths[0]
    taskContext += `\n\n**Working Directory:** ${workingDir}\n\nIMPORTANT: All file reads, writes, and modifications MUST use paths within ${workingDir}. Do NOT access or modify files in any other directory.`
    if (task.worktreePath) {
      taskContext += `\n\nThis is a git worktree. The original project is at ${task.projectPaths[0]} — do NOT modify files there.`
    }
    if (task.projectPaths.length > 1) {
      taskContext += `\nYou also have access to: ${task.projectPaths.slice(1).join(', ')}`
    }
  }
  parts.push(taskContext)

  // 5. Task directory context
  if (task.taskDirPath) {
    const files = listTaskDirFiles(task.id)
    if (files.length > 0) {
      let dirContext = `## Task Directory\n\nPath: ${task.taskDirPath}\n\nFiles available:\n`
      for (const file of files) {
        dirContext += `- ${file}\n`
        // Include content of small text files
        const content = readTaskDirFile(task.id, file)
        if (content && content.length < 10000) {
          dirContext += `\n\`\`\`\n${content}\n\`\`\`\n`
        }
      }
      dirContext += `\nYou can read and write files in this directory. Use it for plans, reviews, and other artifacts.`
      parts.push(dirContext)
    } else {
      parts.push(`## Task Directory\n\nPath: ${task.taskDirPath}\n\nThis directory is empty. You can write files here (plans, reviews, notes) for use in subsequent phases.`)
    }
  }

  // 6. Human review comments (if any, from previous review cycle)
  if (task.humanComments && task.humanComments.length > 0) {
    const comments = task.humanComments.map(c =>
      `- ${c.file}:${c.line}: ${c.comment}`
    ).join('\n')
    parts.push(`## Human Review Comments to Address\n\n${comments}`)
  }

  // 7. Agent review comments (if any, from previous agent review)
  if (task.reviewComments && task.reviewComments.length > 0) {
    const comments = task.reviewComments.map(c =>
      `- ${c.file}${c.line ? `:${c.line}` : ''} [${c.severity}]: ${c.comment}`
    ).join('\n')
    parts.push(`## Agent Review Comments to Address\n\n${comments}`)
  }

  return parts.join('\n\n---\n\n')
}
```

**Step 2: Commit**

```bash
git add src/electron/ai-automation/prompt-builder.ts
git commit -m "refactor(ai): generic phase-driven prompt builder"
```

---

## Task 6: Refactor Agent Runner for Generic Phases

**Files:**
- Modify: `src/electron/ai-automation/agent-runner.ts`

This is the biggest change. The runner needs to:
1. Look up phase config instead of using hardcoded role logic
2. Use generic spawning for any agent phase
3. Use generic completion handling with reject pattern routing

**Step 1: Rewrite processQueue**

Replace the `processQueue` function:

```typescript
function processQueue() {
  const settings = getSettings()
  const pipeline = settings.pipeline || []

  while (taskQueue.length > 0 && runningProcesses.size < settings.maxConcurrency) {
    const taskId = taskQueue.shift()
    if (!taskId) break

    const task = getTaskById(taskId)
    if (!task) continue

    // If task is in BACKLOG, move to first pipeline phase
    if (task.phase === 'BACKLOG' && pipeline.length > 0) {
      moveTaskPhase(taskId, pipeline[0].id)
    }

    // Look up current phase config
    const phaseConfig = pipeline.find(p => p.id === task.phase)
    if (!phaseConfig || phaseConfig.type !== 'agent') continue

    spawnAgent(taskId, phaseConfig)
  }
}
```

**Step 2: Rewrite spawnAgent signature and logic**

Change `spawnAgent(taskId: string, role: AIAgentRole)` to `spawnAgent(taskId: string, phaseConfig: AIPipelinePhase)`.

Key changes inside:
- Replace `buildPrompt(task, role)` with `buildPrompt(task, phaseConfig)`
- Replace role-based tool args with `phaseConfig.allowedTools` (if set)
- Replace role-based message construction with generic: task description + task dir context
- Replace role-based cwd logic: use worktree path > project path > cwd for all phases
- Replace `updateTask(taskId, { activeProcessPid: child.pid, currentAgentRole: role })` with `updateTask(taskId, { activeProcessPid: child.pid, currentPhaseName: phaseConfig.name })`
- On exit: `updateTask(taskId, { activeProcessPid: undefined, currentPhaseName: undefined })`
- Call `handleAgentCompletion(taskId, phaseConfig, fullOutput, code)`

The `--add-dir` for task directory:
```typescript
const addDirArgs: string[] = []
if (task.taskDirPath) {
  addDirArgs.push('--add-dir', task.taskDirPath)
}
if (task.projectPaths && task.projectPaths.length > 1) {
  for (const p of task.projectPaths.slice(1)) {
    addDirArgs.push('--add-dir', p)
  }
}
```

**Step 3: Rewrite handleAgentCompletion**

Change `handleAgentCompletion(taskId: string, role: AIAgentRole, ...)` to `handleAgentCompletion(taskId: string, phaseConfig: AIPipelinePhase, ...)`.

```typescript
function handleAgentCompletion(taskId: string, phaseConfig: AIPipelinePhase, output: string, exitCode: number | null) {
  const task = getTaskById(taskId)
  if (!task) return

  if (exitCode !== 0 && exitCode !== null) {
    updateTask(taskId, { needsUserInput: true })
    return
  }

  const settings = getSettings()
  const pipeline = settings.pipeline || []
  const currentIndex = pipeline.findIndex(p => p.id === phaseConfig.id)

  // Check for reject pattern
  if (phaseConfig.rejectPattern && output.includes(phaseConfig.rejectPattern) && phaseConfig.rejectTarget) {
    const targetExists = pipeline.some(p => p.id === phaseConfig.rejectTarget)
    if (targetExists) {
      moveTaskPhase(taskId, phaseConfig.rejectTarget!)
      enqueueTask(taskId)
      return
    }
  }

  // Move to next phase
  const nextIndex = currentIndex + 1
  if (nextIndex < pipeline.length) {
    moveTaskPhase(taskId, pipeline[nextIndex].id)
    // If next phase is agent, enqueue it
    if (pipeline[nextIndex].type === 'agent') {
      enqueueTask(taskId)
    }
    // If manual, task just waits
  } else {
    // No more phases — move to DONE
    moveTaskPhase(taskId, 'DONE')
  }
}
```

**Step 4: Move worktree creation to first agent phase entry**

Currently worktree creation happens in planner completion. Move it to `spawnAgent`, at the start, but only if the task doesn't already have a worktree:

```typescript
// At the start of spawnAgent, before building the prompt:
if (!task.worktreePath && task.projectPaths?.[0] && task.gitStrategy !== 'none') {
  const branchName = task.customBranchName || generateBranchName(taskId, task.title)
  const baseBranch = task.baseBranch || settings.defaultBaseBranch || undefined
  const worktreeDir = task.worktreeDir || settings.defaultWorktreeDir || undefined
  try {
    const worktreePath = createWorktree(task.projectPaths[0], branchName, baseBranch, worktreeDir)
    updateTask(taskId, { branchName, worktreePath })
    // Re-read task after update
    task = getTaskById(taskId)!
    emit(taskId, `\n📁 Created worktree: ${worktreePath} (branch: ${branchName} from ${baseBranch || 'auto'})\n`)
  } catch (err) {
    emit(taskId, `\n⚠️ Git setup failed: ${(err as Error).message}. Agent will use project directory.\n`)
  }
}

// Also ensure task directory exists
if (!task.taskDirPath) {
  const taskDir = getOrCreateTaskDir(taskId)
  updateTask(taskId, { taskDirPath: taskDir })
  task = getTaskById(taskId)!
}
```

**Step 5: Remove role-based message construction**

Replace the current message building (which switches on role) with a generic approach:

```typescript
let message = task.description
if (task.humanComments && task.humanComments.length > 0) {
  message += '\n\nHuman review comments to address:\n' + task.humanComments.map(c => `- ${c.file}:${c.line}: ${c.comment}`).join('\n')
}
```

The plan, review comments, and other context are now handled by the prompt builder reading from the task directory.

**Step 6: Commit**

```bash
git add src/electron/ai-automation/agent-runner.ts
git commit -m "refactor(ai): generic phase-driven agent runner"
```

---

## Task 7: Update IPC Handlers

**Files:**
- Modify: `src/electron/main.ts`

**Step 1: Update aiMoveTaskPhase handler**

The handler already enqueues on `IN_PROGRESS`. Change it to enqueue whenever the target is an agent phase:

```typescript
ipcMainHandle('aiMoveTaskPhase', async (_event, id, targetPhase) => {
  moveTaskPhase(id, targetPhase)
  const settings = getAISettings()
  const phaseConfig = settings.pipeline?.find(p => p.id === targetPhase)
  if (phaseConfig?.type === 'agent' || targetPhase === 'BACKLOG') {
    // BACKLOG triggers the pipeline start (processQueue handles the first transition)
    enqueueTask(id)
  }
})
```

Wait — actually, moving to BACKLOG shouldn't enqueue. Enqueue should happen when moving to a pipeline phase that has a TODO-like trigger. Let me reconsider.

The current flow: user drags from BACKLOG → first pipeline phase. The IPC handler needs to enqueue for any agent phase. For manual phases, no enqueue needed.

Updated:

```typescript
ipcMainHandle('aiMoveTaskPhase', async (_event, id, targetPhase) => {
  moveTaskPhase(id, targetPhase)
  if (targetPhase !== 'BACKLOG' && targetPhase !== 'DONE') {
    const settings = getAISettings()
    const phaseConfig = settings.pipeline?.find(p => p.id === targetPhase)
    if (phaseConfig?.type === 'agent') {
      enqueueTask(id)
    }
  }
})
```

**Step 2: Add IPC handlers for task directory**

```typescript
import { listTaskDirFiles, readTaskDirFile } from './ai-automation/task-dir-manager.js'

ipcMainHandle('aiGetTaskFiles', async (_event, taskId) => {
  return listTaskDirFiles(taskId)
})

ipcMainHandle('aiReadTaskFile', async (_event, taskId, filename) => {
  return readTaskDirFile(taskId, filename)
})
```

**Step 3: Add IPC type definitions in types.d.ts**

```typescript
aiGetTaskFiles: {
  return: string[];
  args: [string];
}
aiReadTaskFile: {
  return: string;
  args: [string, string];
}
```

And in Window.electron:
```typescript
aiGetTaskFiles: (taskId: string) => Promise<string[]>
aiReadTaskFile: (taskId: string, filename: string) => Promise<string>
```

**Step 4: Add to preload**

```typescript
aiGetTaskFiles: (taskId: string) => ipcInvoke('aiGetTaskFiles', taskId),
aiReadTaskFile: (taskId: string, filename: string) => ipcInvoke('aiReadTaskFile', taskId, filename),
```

**Step 5: Commit**

```bash
git add src/electron/main.ts src/electron/preload.cts types.d.ts
git commit -m "refactor(ai): update IPC handlers for pipeline and task files"
```

---

## Task 8: Update Preload & Context for String Phases

**Files:**
- Modify: `src/electron/preload.cts`
- Modify: `src/ui/contexts/ai-automation.tsx`

**Step 1: Update preload**

Change `aiMoveTaskPhase` parameter type from `AITaskPhase` to `string`:

```typescript
aiMoveTaskPhase: (id: string, targetPhase: string) => ipcInvoke('aiMoveTaskPhase', id, targetPhase),
```

**Step 2: Update context**

Change `moveTaskPhase` signature:

```typescript
moveTaskPhase: (id: string, targetPhase: string) => Promise<void>
```

And the implementation:

```typescript
const moveTaskPhase = useCallback(async (id: string, targetPhase: string) => {
  await window.electron.aiMoveTaskPhase(id, targetPhase)
}, [])
```

**Step 3: Commit**

```bash
git add src/electron/preload.cts src/ui/contexts/ai-automation.tsx
git commit -m "refactor(ai): string-typed phases in preload and context"
```

---

## Task 9: Update Kanban Board for Dynamic Columns

**Files:**
- Modify: `src/ui/views/AIKanban.tsx`

**Step 1: Replace hardcoded PHASES with dynamic columns from settings**

Remove the `PHASES` constant. Read pipeline from settings via context:

```typescript
export const AIKanban: FC = () => {
  const { tasks, moveTaskPhase, deleteTask, settings } = useAIAutomation()
  // ... existing state ...

  const pipeline = settings?.pipeline || []
  const columns: { id: string; label: string }[] = [
    { id: 'BACKLOG', label: 'Backlog' },
    ...pipeline.map(p => ({ id: p.id, label: p.name })),
    { id: 'DONE', label: 'Done' },
  ]

  const tasksByPhase = (phaseId: string) => tasks.filter(t => t.phase === phaseId)
```

**Step 2: Update drag logic**

Replace the hardcoded BACKLOG/TODO check with: allow drag between BACKLOG and first pipeline phase only.

```typescript
const handleDrop = async (targetPhase: string) => {
  if (!draggedTaskId) return
  const task = tasks.find(t => t.id === draggedTaskId)
  if (!task || task.phase === targetPhase) {
    setDraggedTaskId(null)
    return
  }

  const firstPhase = pipeline.length > 0 ? pipeline[0].id : null
  const isAllowed =
    (task.phase === 'BACKLOG' && targetPhase === firstPhase) ||
    (task.phase === firstPhase && targetPhase === 'BACKLOG')
  if (!isAllowed) {
    setDraggedTaskId(null)
    return
  }

  try {
    await moveTaskPhase(draggedTaskId, targetPhase)
  } catch (err) {
    console.error('Failed to move task:', err)
  }
  setDraggedTaskId(null)
}
```

**Step 3: Update running agents count**

Replace hardcoded phase check:

```typescript
const agentPhaseIds = pipeline.filter(p => p.type === 'agent').map(p => p.id)
const runningAgents = tasks.filter(t =>
  agentPhaseIds.includes(t.phase) && t.activeProcessPid
).length
```

**Step 4: Render columns dynamically**

Replace `{PHASES.map(({ phase, label }) => {` with:

```typescript
{columns.map(({ id, label }) => {
  const phaseTasks = tasksByPhase(id)
  return (
    <div
      key={id}
      className="w-[250px] flex flex-col bg-neutral-900/50 rounded-lg border border-neutral-800"
      onDragOver={e => e.preventDefault()}
      onDrop={() => handleDrop(id)}
    >
      {/* same inner structure, using id and label */}
    </div>
  )
})}
```

**Step 5: Commit**

```bash
git add src/ui/views/AIKanban.tsx
git commit -m "feat(ai): dynamic kanban columns from pipeline config"
```

---

## Task 10: Update Task Detail for Dynamic Phases

**Files:**
- Modify: `src/ui/views/AITaskDetail.tsx`

**Step 1: Replace currentAgentRole references with currentPhaseName**

Change all `task.currentAgentRole` references to `task.currentPhaseName`:

- Line showing agent role: `{task.currentPhaseName} agent` → `{task.currentPhaseName}`
- Agent status banner: same change

**Step 2: Replace "Plan" tab with "Task Files" tab**

Replace the Plan TabsTrigger and TabsContent:

```typescript
<TabsTrigger value="files">Task Files</TabsTrigger>
```

```typescript
<TabsContent value="files" className="flex-1 min-h-0 overflow-y-auto p-4">
  <TaskFilesTab taskId={task.id} />
</TabsContent>
```

Create inline `TaskFilesTab` component:

```typescript
const TaskFilesTab: FC<{ taskId: string }> = ({ taskId }) => {
  const [files, setFiles] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [content, setContent] = useState('')

  useEffect(() => {
    window.electron.aiGetTaskFiles(taskId).then(setFiles)
  }, [taskId])

  useEffect(() => {
    if (selectedFile) {
      window.electron.aiReadTaskFile(taskId, selectedFile).then(setContent)
    }
  }, [taskId, selectedFile])

  if (files.length === 0) {
    return <p className="text-neutral-500 text-sm">No task files yet — agents will create files here during execution.</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {files.map(f => (
          <Button
            key={f}
            variant={selectedFile === f ? 'default' : 'outline'}
            size="sm"
            className="text-xs"
            onClick={() => setSelectedFile(f)}
          >
            {f}
          </Button>
        ))}
      </div>
      {selectedFile && (
        <pre className="whitespace-pre-wrap text-sm text-neutral-300 font-mono bg-neutral-900 p-4 rounded border border-neutral-800 max-h-[500px] overflow-y-auto">
          {content || 'Empty file'}
        </pre>
      )}
    </div>
  )
}
```

**Step 3: Update isHumanReview check**

Replace `task.phase === 'HUMAN_REVIEW'` with checking if the phase config is manual:

```typescript
const { settings } = useAIAutomation()
const pipeline = settings?.pipeline || []
const currentPhaseConfig = pipeline.find(p => p.id === task.phase)
const isManualPhase = currentPhaseConfig?.type === 'manual'
```

Use `isManualPhase` instead of `isHumanReview` for showing Approve/Request Changes buttons.

**Step 4: Update Request Changes to route to correct phase**

Currently `handleRequestChanges` hardcodes `moveTaskPhase(task.id, 'IN_PROGRESS')`. Instead, find the previous agent phase:

```typescript
const handleRequestChanges = async () => {
  await updateTask(task.id, { humanComments: reviewComments })
  // Find previous agent phase to send back to
  const currentIndex = pipeline.findIndex(p => p.id === task.phase)
  let targetPhase = pipeline[0]?.id // Default to first phase
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (pipeline[i].type === 'agent') {
      targetPhase = pipeline[i].id
      break
    }
  }
  if (targetPhase) {
    await moveTaskPhase(task.id, targetPhase)
  }
}
```

**Step 5: Commit**

```bash
git add src/ui/views/AITaskDetail.tsx
git commit -m "feat(ai): dynamic phase display and task files tab"
```

---

## Task 11: Add Pipeline Editor to Settings

**Files:**
- Modify: `src/ui/views/AISettings.tsx`

**Step 1: Add "Pipeline" tab**

Add a new TabsTrigger `pipeline` in the TabsList, and a corresponding TabsContent.

**Step 2: Create PipelineTab component**

```typescript
const PipelineTab: FC<SettingsTabProps> = ({ settings, updateSettings }) => {
  const pipeline = settings.pipeline || []

  const addPhase = () => {
    const newPhase: AIPipelinePhase = {
      id: crypto.randomUUID(),
      name: 'New Phase',
      type: 'agent',
      prompt: '',
    }
    updateSettings({ pipeline: [...pipeline, newPhase] })
  }

  const updatePhase = (id: string, updates: Partial<AIPipelinePhase>) => {
    updateSettings({
      pipeline: pipeline.map(p => p.id === id ? { ...p, ...updates } : p)
    })
  }

  const deletePhase = (id: string) => {
    // Also clear any rejectTarget references to this phase
    updateSettings({
      pipeline: pipeline
        .filter(p => p.id !== id)
        .map(p => p.rejectTarget === id ? { ...p, rejectTarget: undefined, rejectPattern: undefined } : p)
    })
  }

  const movePhase = (index: number, direction: -1 | 1) => {
    const newPipeline = [...pipeline]
    const target = index + direction
    if (target < 0 || target >= newPipeline.length) return
    ;[newPipeline[index], newPipeline[target]] = [newPipeline[target], newPipeline[index]]
    updateSettings({ pipeline: newPipeline })
  }

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-neutral-400">
        Configure the phases a task flows through between Backlog and Done. Each phase is either an AI agent step or a manual human step.
      </p>

      {/* Fixed start */}
      <div className="px-3 py-2 rounded bg-neutral-800/50 border border-neutral-700 text-sm text-neutral-400">
        Backlog (fixed)
      </div>

      {/* Pipeline phases */}
      {pipeline.map((phase, index) => (
        <PipelinePhaseCard
          key={phase.id}
          phase={phase}
          index={index}
          total={pipeline.length}
          allPhases={pipeline}
          onUpdate={(updates) => updatePhase(phase.id, updates)}
          onDelete={() => deletePhase(phase.id)}
          onMove={(dir) => movePhase(index, dir)}
        />
      ))}

      <Button size="sm" onClick={addPhase}>
        <Plus className="h-4 w-4 mr-1" /> Add Phase
      </Button>

      {/* Fixed end */}
      <div className="px-3 py-2 rounded bg-neutral-800/50 border border-neutral-700 text-sm text-neutral-400">
        Done (fixed)
      </div>
    </div>
  )
}
```

**Step 3: Create PipelinePhaseCard component**

Each card is expandable and shows: name, type, prompt, allowedTools, rejectPattern, rejectTarget.

```typescript
const PipelinePhaseCard: FC<{
  phase: AIPipelinePhase
  index: number
  total: number
  allPhases: AIPipelinePhase[]
  onUpdate: (updates: Partial<AIPipelinePhase>) => void
  onDelete: () => void
  onMove: (direction: -1 | 1) => void
}> = ({ phase, index, total, allPhases, onUpdate, onDelete, onMove }) => {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-neutral-700 rounded-md overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-neutral-800/50">
        <div className="flex flex-col gap-0.5">
          <button onClick={() => onMove(-1)} disabled={index === 0} className="text-neutral-500 hover:text-white disabled:opacity-30">
            <ChevronUp className="h-3 w-3" />
          </button>
          <button onClick={() => onMove(1)} disabled={index === total - 1} className="text-neutral-500 hover:text-white disabled:opacity-30">
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
        <button className="flex-1 text-left" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{phase.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${phase.type === 'agent' ? 'bg-blue-900/50 text-blue-300' : 'bg-neutral-700 text-neutral-300'}`}>
              {phase.type}
            </span>
            {phase.rejectPattern && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300">has routing</span>
            )}
          </div>
        </button>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5 text-red-400" />
        </Button>
      </div>

      {expanded && (
        <div className="px-3 py-3 space-y-3 border-t border-neutral-700">
          <div className="flex gap-3">
            <div className="flex-1">
              <Label>Name</Label>
              <Input value={phase.name} onChange={e => onUpdate({ name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={phase.type} onValueChange={v => onUpdate({ type: v as 'agent' | 'manual' })}>
                <SelectTrigger className="mt-1 w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {phase.type === 'agent' && (
            <>
              <div>
                <Label>System Prompt</Label>
                <Textarea
                  value={phase.prompt || ''}
                  onChange={e => onUpdate({ prompt: e.target.value })}
                  placeholder="Instructions for the AI agent in this phase..."
                  rows={6}
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <div>
                <Label>Allowed Tools <span className="text-neutral-500 font-normal">(optional)</span></Label>
                <Input
                  value={phase.allowedTools || ''}
                  onChange={e => onUpdate({ allowedTools: e.target.value })}
                  placeholder="Leave empty for all tools, or e.g. Read,Glob,Grep,Bash(git:*)"
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label>Reject Pattern <span className="text-neutral-500 font-normal">(optional)</span></Label>
                  <Input
                    value={phase.rejectPattern || ''}
                    onChange={e => onUpdate({ rejectPattern: e.target.value })}
                    placeholder="e.g. REVIEW_DECISION: REJECT"
                    className="mt-1 font-mono text-sm"
                  />
                </div>
                <div className="flex-1">
                  <Label>Reject Target</Label>
                  <Select
                    value={phase.rejectTarget || ''}
                    onValueChange={v => onUpdate({ rejectTarget: v || undefined })}
                  >
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select phase..." /></SelectTrigger>
                    <SelectContent>
                      {allPhases.filter(p => p.id !== phase.id).map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
```

Note: you'll need to import `ChevronUp, ChevronDown` from lucide-react.

**Step 4: Commit**

```bash
git add src/ui/views/AISettings.tsx
git commit -m "feat(ai): pipeline editor in settings UI"
```

---

## Task 12: Migration Logic for Existing Tasks

**Files:**
- Modify: `src/electron/ai-automation/task-manager.ts`

**Step 1: Add migration function**

```typescript
export function migrateExistingTasks() {
  const settings = getSettings()
  if (!settings.pipeline || settings.pipeline.length === 0) return

  const tasks = store.get('aiTasks')
  let changed = false

  const PHASE_MAP: Record<string, string> = {
    'TODO': settings.pipeline[0]?.id || 'BACKLOG',  // TODO was the trigger, map to first phase
    'PLANNING': 'planning',
    'IN_PROGRESS': 'in-progress',
    'AGENT_REVIEW': 'agent-review',
    'HUMAN_REVIEW': 'human-review',
  }

  for (const task of tasks) {
    if (task.phase in PHASE_MAP) {
      task.phase = PHASE_MAP[task.phase]
      changed = true
    }
    // Migrate phase history entries too
    for (const entry of task.phaseHistory) {
      if (entry.phase in PHASE_MAP) {
        entry.phase = PHASE_MAP[entry.phase]
        changed = true
      }
    }
  }

  if (changed) {
    store.set('aiTasks', tasks)
  }
}
```

**Step 2: Add settings migration**

```typescript
export function migrateSettings() {
  const settings = store.get('aiAutomationSettings')

  // If pipeline already exists, skip
  if (settings.pipeline && settings.pipeline.length > 0) return

  // Initialize default pipeline (imported from store defaults)
  const pipeline = [...DEFAULT_PIPELINE]

  // Copy existing phase prompts into pipeline
  if (settings.phasePrompts) {
    if (settings.phasePrompts.planning) {
      const planningPhase = pipeline.find(p => p.id === 'planning')
      if (planningPhase) planningPhase.prompt = settings.phasePrompts.planning
    }
    if (settings.phasePrompts.working) {
      const workingPhase = pipeline.find(p => p.id === 'in-progress')
      if (workingPhase) workingPhase.prompt = settings.phasePrompts.working
    }
    if (settings.phasePrompts.reviewing) {
      const reviewPhase = pipeline.find(p => p.id === 'agent-review')
      if (reviewPhase) reviewPhase.prompt = settings.phasePrompts.reviewing
    }
  }

  store.set('aiAutomationSettings', { ...settings, pipeline })
}
```

**Step 3: Call migrations on app startup**

In `src/electron/main.ts`, after the AI imports, call:

```typescript
import { migrateSettings, migrateExistingTasks } from './ai-automation/task-manager.js'

// Call early in app.whenReady():
migrateSettings()
migrateExistingTasks()
```

**Step 4: Commit**

```bash
git add src/electron/ai-automation/task-manager.ts src/electron/main.ts
git commit -m "feat(ai): migration logic for existing tasks and settings"
```

---

## Task 13: Update TaskCard for Dynamic Phase Display

**Files:**
- Modify: `src/ui/components/ai-automation/TaskCard.tsx`

**Step 1: Replace currentAgentRole with currentPhaseName**

Change references from `task.currentAgentRole` to `task.currentPhaseName`:

```typescript
{task.currentPhaseName && (
  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-300">
    {task.currentPhaseName}
  </span>
)}
```

**Step 2: Commit**

```bash
git add src/ui/components/ai-automation/TaskCard.tsx
git commit -m "refactor(ai): use currentPhaseName in TaskCard"
```

---

## Task 14: Verify Full Pipeline Flow

**Manual test steps:**

1. Start the app: `npm run dev`
2. Open AI Kanban → Settings → Pipeline tab
3. Verify the 4 default phases are shown: Planning, In Progress, Agent Review, Human Review
4. Verify the kanban board shows: Backlog + 4 pipeline columns + Done
5. Create a new task, drag from Backlog to Planning
6. Verify the planner agent spawns and produces output
7. Verify the task auto-advances through the pipeline
8. At Human Review, verify the Changes tab shows diff with comment capability
9. Click Request Changes, verify the task goes back to the worker agent
10. In Settings → Pipeline, add a new phase (e.g. "QA Check" as manual) between Agent Review and Human Review
11. Verify the kanban board updates with the new column
12. Verify existing tasks still display correctly

---

## Future Tasks (not in this plan)

- **Multiple routing targets** — phase config supports array of `{ pattern, target }` instead of single rejectPattern
- **Customizable terminal states** — multiple done statuses
- **Pipeline templates/presets** — save/load pipeline configs
- **Phase-level max retry count** — replace global defaultMaxReviewCycles
- **Drag & drop reorder** in pipeline editor (currently up/down buttons)
