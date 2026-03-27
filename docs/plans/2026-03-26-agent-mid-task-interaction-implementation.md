# F60: Agent Mid-Task Interaction — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to interrupt a running agent and send a message. The agent stops, then resumes with full conversation context via Claude CLI's `--resume` flag.

**Architecture:** Kill + resume pattern. User message stored in-memory, process killed, respawned with `--resume <sessionId>`. All existing infrastructure (stream-json, stats, stall detection, phase routing) stays unchanged.

**Design doc:** `docs/plans/2026-03-26-agent-mid-task-interaction-design.md`

---

### Task 1: Add sessionId to AITask type

**Files:**
- Modify: `types/ai-automation.d.ts`

**Changes:**

Add `sessionId` field to the `AITask` interface, after `linkedTaskIds`:

```typescript
sessionId?: string
```

No migration needed — optional field, existing tasks simply won't have it.

**Verify:** `npx tsc --noEmit` + `npm run transpile:electron`

---

### Task 2: Add pendingUserMessages map and interruptAgent function

**Files:**
- Modify: `src/electron/ai-automation/agent-runner.ts`

**Changes:**

1. Add in-memory map at the top (next to `runningProcesses`):

```typescript
const pendingUserMessages = new Map<string, string>()
```

2. Add exported `interruptAgent` function:

```typescript
export function interruptAgent(taskId: string, message: string): void {
  const proc = runningProcesses.get(taskId)
  if (!proc || proc.pid === undefined) return

  pendingUserMessages.set(taskId, message)
  treeKill(proc.pid, 'SIGTERM', (err) => {
    if (err) {
      treeKill(proc.pid!, 'SIGKILL', () => {})
    }
  })
}
```

This stores the message and kills the process. When the process exits, `handleAgentCompletion` will pick up the pending message (Task 4).

**Verify:** `npx tsc --noEmit` + `npm run transpile:electron`

---

### Task 3: Modify spawnAgent to generate and pass --session-id

**Files:**
- Modify: `src/electron/ai-automation/agent-runner.ts`

**Changes:**

In `spawnAgent`, after the prompt is built and before constructing the args array:

1. Generate a new session ID and store it on the task:

```typescript
const sessionId = randomUUID()
updateTask(taskId, { sessionId })
```

2. Add `'--session-id', sessionId` to the `args` array, before `'--'`.

Import `randomUUID` from `'crypto'` (already imported in task-manager, check if agent-runner has it — it doesn't, add the import).

**Verify:** `npx tsc --noEmit` + `npm run transpile:electron`

---

### Task 4: Add resumeAgent function and modify handleAgentCompletion

**Files:**
- Modify: `src/electron/ai-automation/agent-runner.ts`

**Changes:**

**4a. Add `resumeAgent` function:**

This function is similar to `spawnAgent` but:
- Uses `--resume <sessionId>` instead of `--session-id <uuid>`
- The prompt argument (`--`) is the user's message, not the task description
- Does NOT generate a new session ID (reuses existing)
- Does NOT create worktrees (already created in first spawn)
- Does NOT create a new context-history directory (appends to existing phase run)
- DOES rebuild all other args (system prompt, settings, tools, MCP config, cwd, add-dir) from phaseConfig + settings — same reconstruction logic as spawnAgent

Extract the shared arg-building logic from `spawnAgent` into a helper (e.g., `buildSpawnArgs`) that both functions call. The helper takes `task`, `phaseConfig`, `settings` and returns `{ args, cwd, env }`. Then:

- `spawnAgent` calls `buildSpawnArgs`, prepends `--session-id <uuid>`, appends `-- <task description>`
- `resumeAgent` calls `buildSpawnArgs`, prepends `--resume <sessionId>`, appends `-- <user message>`

Both functions share the same process setup: `spawn`, `runningProcesses.set`, `child.stdin?.end()`, stdout/stderr parsing, stall detection.

Extract the process setup + output parsing into a helper too (e.g., `startAgentProcess`) to avoid duplicating the ~100 lines of stream parsing, stats tracking, and stall detection setup.

Signature:

```typescript
function resumeAgent(taskId: string, userMessage: string): void
```

**4b. Modify `handleAgentCompletion`:**

Add a check at the very top, before any existing logic:

```typescript
const pendingMessage = pendingUserMessages.get(taskId)
if (pendingMessage !== undefined) {
  pendingUserMessages.delete(taskId)
  const task = getTaskById(taskId)
  if (!task) return
  const pipeline = getBoardPipeline(task.boardId)
  const phaseConfig = pipeline.find(p => p.id === task.phase)
  if (!phaseConfig) return
  resumeAgent(taskId, pendingMessage)
  return
}
```

This intercepts the "killed for user message" exit before it reaches the crash/completion logic.

**Verify:** `npx tsc --noEmit` + `npm run transpile:electron`

---

### Task 5: Clear sessionId on phase transitions

**Files:**
- Modify: `src/electron/ai-automation/task-manager.ts`

**Changes:**

In `moveTaskPhase`, clear the session ID when the task moves to a new phase. Add `sessionId: undefined` to the task update object (around line 187):

```typescript
tasks[index] = {
  ...task,
  phase: targetPhase,
  updatedAt: now,
  phaseHistory: history,
  needsUserInput: false,
  needsUserInputReason: undefined,
  stallRetryCount: 0,
  currentPhaseName,
  sessionId: undefined,
}
```

Each new phase spawns a fresh session with its own system prompt and tools.

**Verify:** `npx tsc --noEmit` + `npm run transpile:electron`

---

### Task 6: Add IPC handler and preload bridge

**Files:**
- Modify: `types/ipc.d.ts` (EventPayloadMapping + Window interface)
- Modify: `src/electron/handlers/ai-handlers.ts`
- Modify: `src/electron/preload.cts`

**Changes:**

**6a. Types** — Add to `EventPayloadMapping` in `types/ipc.d.ts`:

```typescript
aiInterruptAgent: {
  args: [string, string]  // taskId, message
  return: void
}
```

Add to the `Window.electron` interface:

```typescript
aiInterruptAgent: (taskId: string, message: string) => Promise<void>
```

**6b. Handler** — In `src/electron/handlers/ai-handlers.ts`, add:

```typescript
ipcMainHandle('aiInterruptAgent', async (_event, taskId, message) => {
  interruptAgent(taskId, message)
})
```

Import `interruptAgent` from `../ai-automation/agent-runner.js`.

**6c. Preload** — In `src/electron/preload.cts`, add:

```typescript
aiInterruptAgent: (taskId: string, message: string) => ipcInvoke('aiInterruptAgent', taskId, message),
```

**Verify:** `npx tsc --noEmit` + `npm run transpile:electron`

---

### Task 7: Wire AgentTerminal to new IPC handler

**Files:**
- Modify: `src/ui/components/ai-automation/AgentTerminal.tsx`

**Changes:**

1. Replace the `handleSend` function to use the new interrupt IPC instead of the old stdin-based `aiSendTaskInput`:

```typescript
const handleSend = () => {
  if (!input.trim()) return
  window.electron.aiInterruptAgent(taskId, input)
  setLines(prev => [...prev, `> ${input}`])
  setInput('')
}
```

2. Optionally add a brief "Resuming..." line after the user message (the agent output subscription will pick up new output when the resumed process starts streaming).

The existing `aiSendTaskInput` IPC handler and preload method can remain for now (removing dead code is a separate cleanup). The AgentTerminal just stops calling it.

**Verify:** `npx tsc --noEmit` + `npm run transpile:electron`

---

### Task 8: Manual testing

No automated tests in this project. Verify manually:

1. **Basic interrupt:** Start a task, let the agent begin working, type a message in the terminal. Confirm: process is killed, resumes with the message, agent responds to the user's input and continues working.

2. **Multiple interrupts:** Send 2-3 messages during a single phase. Confirm each kill/resume cycle works and context accumulates.

3. **Natural completion after interrupts:** After interrupting, let the agent finish naturally. Confirm phase transition works normally (next phase or DONE).

4. **Phase transition resets session:** Confirm a new session ID is generated when the task moves to the next phase.

5. **Crash vs interrupt:** Kill the app while an agent is running (no pending message). Confirm crash recovery still works as before (needsUserInput flag, attention notification).
