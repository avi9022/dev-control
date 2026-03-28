# F6: Crash Recovery & Stall Detection — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Detect stale agent PIDs on startup and stalled agents at runtime, with automatic retry, user-facing indicators, and configurable timeouts.

**Architecture:** On startup, scan tasks for orphaned PIDs and flag them. At runtime, track last event time per agent and kill+retry on timeout. UI shows warning badges on kanban cards and banners in task detail with retry/backlog actions.

**Tech Stack:** Existing Electron IPC, electron-store, React context, CSS variables

**Note:** This project has no test suite. Steps focus on implementation and visual verification.

---

### Task 1: Data model — types, enum, defaults

**Files:**
- Modify: `types.d.ts`
- Modify: `src/electron/storage/store.ts`

**Step 1: Add AITaskAttentionReason enum to types.d.ts**

Find `interface AIHumanComment` (around line 655) and add before it:

```typescript
enum AITaskAttentionReason {
  Crashed = 'crashed',
  Stalled = 'stalled',
  MaxRetries = 'max_retries',
  Error = 'error',
}
```

**Step 2: Add fields to AITask in types.d.ts**

Find the `needsUserInput: boolean` field in `interface AITask` and add after it:

```typescript
  needsUserInputReason?: AITaskAttentionReason
  stallRetryCount?: number
```

**Step 3: Add stallTimeout to AIPipelinePhase in types.d.ts**

Find `color?: string` in `interface AIPipelinePhase` and add after it:

```typescript
  stallTimeout?: number  // per-phase override in minutes
```

**Step 4: Add stallTimeoutMinutes to AIAutomationSettings in types.d.ts**

Find `theme?: 'dark' | 'light'` in `interface AIAutomationSettings` and add before it:

```typescript
  stallTimeoutMinutes: number
```

**Step 5: Add default in store.ts**

Find the `aiAutomationSettings` default object in store.ts and add `stallTimeoutMinutes: 3` after `knowledgeDocs: []`.

**Step 6: Commit**

```bash
git add types.d.ts src/electron/storage/store.ts
git commit -m "feat(f6): add AITaskAttentionReason enum, stall timeout settings, and attention fields"
```

---

### Task 2: Crash recovery on startup

**Files:**
- Modify: `src/electron/ai-automation/task-manager.ts`
- Modify: `src/electron/main.ts`

**Step 1: Add recoverStaleTasks function in task-manager.ts**

Add after the existing `migrateExistingTasks` function (around line 295):

```typescript
export function recoverStaleTasks(): void {
  const tasks = getTasks()
  let changed = false
  const updated = tasks.map(task => {
    if (!task.activeProcessPid) return task
    // Check if the PID is still alive
    let alive = false
    try {
      process.kill(task.activeProcessPid, 0)
      alive = true
    } catch {
      // Process doesn't exist
    }
    if (!alive) {
      console.log(`[task-manager] Recovered stale task: ${task.id} (pid ${task.activeProcessPid} no longer running)`)
      changed = true
      return {
        ...task,
        activeProcessPid: undefined,
        currentPhaseName: undefined,
        needsUserInput: true,
        needsUserInputReason: 'crashed' as AITaskAttentionReason,
        updatedAt: new Date().toISOString(),
      }
    }
    return task
  })
  if (changed) {
    store.set('aiTasks', updated)
    broadcastTasks()
  }
}
```

Note: Import `AITaskAttentionReason` is not needed since it's a TS enum that will be in the global types. The string value `'crashed'` matches the enum. Use the string literal with the `as` cast.

**Step 2: Call recoverStaleTasks in main.ts**

Find where `migrateExistingTasks()` is called (around line 236) and add after it:

```typescript
import { ..., recoverStaleTasks } from './ai-automation/task-manager.js'
// ... in the ready handler:
recoverStaleTasks()
```

**Step 3: Commit**

```bash
git add src/electron/ai-automation/task-manager.ts src/electron/main.ts
git commit -m "feat(f6): detect and recover stale agent PIDs on startup"
```

---

### Task 3: Stall detection in agent runner

**Files:**
- Modify: `src/electron/ai-automation/agent-runner.ts`

**Step 1: Add stall detection to spawnAgent**

In `spawnAgent`, after the line that creates `const stats = initStats(taskId)` (around line 541), add:

```typescript
  // Stall detection
  let lastEventTime = Date.now()
  const stallTimeoutMs = ((phaseConfig.stallTimeout ?? settings.stallTimeoutMinutes ?? 3) * 60 * 1000)
  const stallCheckInterval = setInterval(() => {
    const elapsed = Date.now() - lastEventTime
    if (elapsed > stallTimeoutMs) {
      clearInterval(stallCheckInterval)
      const currentTask = getTaskById(taskId)
      if (!currentTask) return
      const retryCount = (currentTask.stallRetryCount || 0) + 1
      const maxRetries = 3

      emitText(`\n⚠️ Agent stalled (no events for ${Math.round(elapsed / 60000)}min)\n`)

      // Kill the process
      const proc = runningProcesses.get(taskId)
      if (proc) {
        try { treeKill(proc.pid!, 'SIGKILL') } catch { /* */ }
        runningProcesses.delete(taskId)
      }

      if (retryCount < maxRetries) {
        emitText(`⚠️ Retrying phase (attempt ${retryCount + 1}/${maxRetries})...\n`)
        updateTask(taskId, {
          activeProcessPid: undefined,
          currentPhaseName: undefined,
          stallRetryCount: retryCount,
        })
        // Re-enqueue for same phase
        enqueueTask(taskId)
      } else {
        emitText(`⚠️ Max retries reached — needs attention\n`)
        updateTask(taskId, {
          activeProcessPid: undefined,
          currentPhaseName: undefined,
          needsUserInput: true,
          needsUserInputReason: 'max_retries' as AITaskAttentionReason,
          stallRetryCount: retryCount,
        })
      }
    }
  }, 30000)
```

**Step 2: Update lastEventTime on every event**

In the stdout data handler, inside the `for (const line of lines)` loop, after `const event = JSON.parse(line)`, add:

```typescript
        lastEventTime = Date.now()
```

**Step 3: Clear interval on exit**

In the `child.on('exit')` handler, add at the top:

```typescript
    clearInterval(stallCheckInterval)
```

Also in the `child.on('error')` handler, add:

```typescript
    clearInterval(stallCheckInterval)
```

**Step 4: Reset stallRetryCount on successful completion**

In the `handleAgentCompletion` function, when the phase completes successfully (agent exits with code 0 or routes to next phase), add:

```typescript
updateTask(taskId, { stallRetryCount: 0 })
```

Find where `handleAgentCompletion` calls `moveTaskPhase` or handles success — add the reset there.

**Step 5: Update error handler to use reason**

Find where the spawn error sets `needsUserInput: true` and change to also set:

```typescript
needsUserInputReason: 'error' as AITaskAttentionReason,
```

**Step 6: Commit**

```bash
git add src/electron/ai-automation/agent-runner.ts
git commit -m "feat(f6): runtime stall detection with auto-retry and max retries"
```

---

### Task 4: UI — TaskCard warning badge with dropdown

**Files:**
- Modify: `src/ui/components/ai-automation/TaskCard.tsx`

**Step 1: Add warning badge with dropdown**

Replace the existing `AlertCircle` indicator for `needsUserInput` with an interactive badge that shows a dropdown on click.

The badge should:
- Show an amber `AlertCircle` icon (already exists, enhance it)
- On click (stopPropagation to prevent opening task detail), show a small dropdown
- Dropdown shows reason text and two buttons: "Retry Phase" and "Move to Backlog"

The component needs new props:
```typescript
interface TaskCardProps {
  task: AITask
  onClick: () => void
  onDelete: () => void
  onRetryPhase: (taskId: string) => void
  onMoveToBacklog: (taskId: string) => void
}
```

Reason text mapping:
- `crashed`: "Agent interrupted"
- `stalled`: "Agent stalled"
- `max_retries`: "Stall retries exhausted"
- `error`: "Agent error"
- undefined/missing: "Needs attention"

Use a `useState<boolean>` for dropdown visibility. Dropdown positioned absolute below the badge. Click outside closes it (use a useEffect with window click listener).

**Step 2: Update TaskCard usage in AIKanban.tsx**

Find where TaskCard is rendered and pass the new `onRetryPhase` and `onMoveToBacklog` props. These should call the appropriate context functions:
- `onRetryPhase`: clear needsUserInput flags + re-enqueue via `moveTaskPhase(taskId, task.phase)` or a new IPC
- `onMoveToBacklog`: clear flags + `moveTaskPhase(taskId, 'BACKLOG')`

This may need a new IPC handler `aiRetryTaskPhase` that clears the flags and re-enqueues, or you can use `updateTask` to clear flags then `moveTaskPhase` to BACKLOG.

**Step 3: Commit**

```bash
git add src/ui/components/ai-automation/TaskCard.tsx src/ui/views/AIKanban.tsx
git commit -m "feat(f6): warning badge with retry/backlog actions on TaskCard"
```

---

### Task 5: UI — Task detail warning banner

**Files:**
- Modify: `src/ui/views/AITaskDetail.tsx`

**Step 1: Add warning banner**

After the task header buttons section and before the tabs, add a conditional banner when `task.needsUserInput` is true:

```tsx
{task.needsUserInput && (
  <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg mb-3"
    style={{ backgroundColor: 'var(--ai-warning-subtle)', border: '1px solid var(--ai-warning)' }}>
    <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: 'var(--ai-warning)' }} />
    <span className="text-sm flex-1" style={{ color: 'var(--ai-warning)' }}>
      {reason text based on task.needsUserInputReason}
    </span>
    <Button size="sm" onClick={handleRetryPhase}>Retry Phase</Button>
    <Button size="sm" variant="outline" onClick={handleMoveToBacklog}>Move to Backlog</Button>
  </div>
)}
```

Reason text:
- `crashed`: "This agent was interrupted when the app closed"
- `max_retries`: "This agent stalled repeatedly and stopped after 3 retries"
- `error`: "This agent exited with an error"
- default: "This task needs attention"

`handleRetryPhase` and `handleMoveToBacklog` should:
- Call `updateTask(task.id, { needsUserInput: false, needsUserInputReason: undefined, stallRetryCount: 0 })`
- Then either re-enqueue (retry) or `moveTaskPhase(task.id, 'BACKLOG')` (backlog)

Import `AlertTriangle` from lucide-react.

**Step 2: Commit**

```bash
git add src/ui/views/AITaskDetail.tsx
git commit -m "feat(f6): warning banner in task detail with retry/backlog actions"
```

---

### Task 6: Settings UI — stall timeout

**Files:**
- Modify: `src/ui/views/AISettings.tsx` (GeneralTab)
- Modify: `src/ui/components/ai-automation/PhaseEditDialog.tsx`

**Step 1: Add global stall timeout to GeneralTab**

In the GeneralTab component in AISettings.tsx, add after the "Max Concurrent Agents" setting:

```tsx
<div>
  <Label>Stall Timeout (minutes)</Label>
  <p className="text-xs mb-1" style={{ color: 'var(--ai-text-tertiary)' }}>
    Kill and retry an agent if no events are received for this duration.
  </p>
  <Input
    type="number"
    min={1}
    max={30}
    value={settings.stallTimeoutMinutes}
    onChange={e => updateSettings({ stallTimeoutMinutes: Math.max(1, Math.min(30, parseInt(e.target.value) || 3)) })}
    className="w-24"
  />
</div>
```

**Step 2: Add per-phase stall timeout to PhaseEditDialog**

In PhaseEditDialog.tsx, inside the agent-only section (after Reject Target), add:

```tsx
<div>
  <Label>Stall Timeout Override <span className="font-normal" style={{ color: 'var(--ai-text-tertiary)' }}>(optional, minutes)</span></Label>
  <Input
    type="number"
    min={1}
    max={30}
    value={localStallTimeout}
    onChange={e => setLocalStallTimeout(e.target.value)}
    onBlur={() => onUpdate(phase.id, { stallTimeout: localStallTimeout ? parseInt(localStallTimeout) : undefined })}
    placeholder={`Global: ${globalTimeout}min`}
    className="w-32"
  />
</div>
```

Add `localStallTimeout` state synced from `phase.stallTimeout`. The PhaseEditDialog doesn't have access to global settings, so pass a placeholder showing the global value, or just use "Global default" as placeholder text.

**Step 3: Commit**

```bash
git add src/ui/views/AISettings.tsx src/ui/components/ai-automation/PhaseEditDialog.tsx
git commit -m "feat(f6): stall timeout settings in general tab and per-phase override"
```

---

### Task 7: Lint and verify

**Files:**
- All modified files

**Step 1: Run lint**

```bash
npx eslint src/electron/ai-automation/task-manager.ts src/electron/ai-automation/agent-runner.ts src/electron/main.ts src/ui/components/ai-automation/TaskCard.tsx src/ui/views/AITaskDetail.tsx src/ui/views/AISettings.tsx src/ui/components/ai-automation/PhaseEditDialog.tsx
```

Fix any errors.

**Step 2: Transpile**

```bash
npm run transpile:electron
```

Fix any type errors.

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(f6): crash recovery and stall detection complete"
```
