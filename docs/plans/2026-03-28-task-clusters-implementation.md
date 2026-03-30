# Task Clusters — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow tasks to contain ordered subtasks that share a worktree, run through the full pipeline sequentially, and auto-advance on completion.

**Architecture:** Parent-child model. Parent task holds shared resources (worktree, projects). Subtasks have their own phase history, agent sessions, and diff baselines. Kanban shows one card per cluster with expand animation.

**Design doc:** `docs/plans/2026-03-28-task-clusters-design.md`

---

### Task 1: Define types

**Files:**
- Modify: `types/ai-automation.d.ts`

**Changes:**

Add `AISubtask` interface:

```typescript
interface AISubtask {
  id: string
  title: string
  description: string
  phase: AITaskPhase
  createdAt: string
  updatedAt: string
  phaseHistory: AIPhaseHistoryEntry[]
  sessionId?: string
  humanComments?: AIHumanComment[]
  reviewComments?: AIReviewComment[]
  amendments?: AITaskAmendment[]
  excludedFiles?: string[]
  activeProcessPid?: number
  currentPhaseName?: string
  needsUserInput: boolean
  needsUserInputReason?: AITaskAttentionReason
  stallRetryCount?: number
  diffBaseline?: string
  taskDirPath?: string
}
```

Add fields to `AITask`:

```typescript
isCluster?: boolean
subtasks?: AISubtask[]
activeSubtaskIndex?: number
```

**Verify:** `npx tsc --noEmit` + `npm run transpile:electron`

---

### Task 2: Cluster creation in task manager

**Files:**
- Modify: `src/electron/ai-automation/task-manager.ts`

**Changes:**

Add `createCluster` function:

```typescript
export function createCluster(
  title: string,
  subtaskDefs: Array<{ title: string; description: string }>,
  projects: AITaskProject[],
  boardId?: string
): AITask
```

- Creates a parent `AITask` with `isCluster: true`, empty description
- Creates `AISubtask` objects from `subtaskDefs` with `phase: BACKLOG`, unique IDs
- Sets `activeSubtaskIndex: 0`
- Stores in `subtasks` array on the parent
- Creates task directory with subdirectories per subtask

Add `getActiveSubtask` helper:

```typescript
export function getActiveSubtask(task: AITask): AISubtask | undefined
```

Add `advanceClusterSubtask` function:

```typescript
export function advanceClusterSubtask(taskId: string): void
```

- Called when a subtask reaches DONE
- Saves HEAD commit hash as `diffBaseline` on the next subtask
- Increments `activeSubtaskIndex`
- If more subtasks: moves next subtask to first pipeline phase, enqueues it
- If last subtask done: moves parent to DONE

**Verify:** `npx tsc --noEmit` + `npm run transpile:electron`

---

### Task 3: Wire cluster into agent lifecycle

**Files:**
- Modify: `src/electron/ai-automation/agent-lifecycle.ts`
- Modify: `src/electron/ai-automation/agent-runner.ts`

**Changes:**

Modify `spawnAgent` and `resumeAgent` to handle clusters:
- When spawning for a cluster task, resolve the active subtask
- Use the subtask's description, phase, sessionId, phaseHistory
- Use the parent's worktree, projects, taskDirPath
- Build prompt with cluster context section

Modify `handleAgentCompletion`:
- When a cluster subtask completes its pipeline (reaches DONE via normal phase routing), call `advanceClusterSubtask`

Modify the queue's `processQueue`:
- When processing a cluster task, look at the active subtask's phase to determine if it should run

**Verify:** `npx tsc --noEmit` + `npm run transpile:electron`

---

### Task 4: Cluster context in prompt builder

**Files:**
- Modify: `src/electron/ai-automation/prompt-builder.ts`

**Changes:**

When building a prompt for a cluster subtask, add a "Cluster Context" section:

```
## Cluster Context

You are working on subtask 2 of 4 for: "Add payment system"

Completed subtasks:
1. Set up database schema (DONE)

Current subtask:
2. Implement API endpoints

Upcoming subtasks:
3. Build frontend forms
4. Add integration tests

Work in the same worktree as previous subtasks. Previous work is already committed.
```

**Verify:** `npx tsc --noEmit` + `npm run transpile:electron`

---

### Task 5: Diff baseline tracking

**Files:**
- Modify: `src/electron/ai-automation/worktree-manager.ts` (or new helper)
- Modify: `src/electron/ai-automation/task-manager.ts`

**Changes:**

Add function to capture current HEAD:

```typescript
export function getWorktreeHead(worktreePath: string): string
```

Runs `git rev-parse HEAD` in the worktree directory.

Modify diff retrieval (`getDiff`):
- When getting diff for a cluster subtask with `diffBaseline`, use `git diff <baseline>..HEAD` instead of the default branch diff
- When no baseline (first subtask), use normal diff behavior

Wire into `advanceClusterSubtask`:
- Before advancing, capture HEAD and store as `diffBaseline` on the next subtask

**Verify:** `npx tsc --noEmit` + `npm run transpile:electron`

---

### Task 6: Create `create_cluster` MCP tool

**Files:**
- Create: `src/electron/ai-automation/mcp-tools/create-cluster.ts`
- Modify: `src/electron/ai-automation/mcp-tools/index.ts`

**Changes:**

New MCP tool with schema:
- `title: string` — cluster name
- `subtasks: Array<{ title: string; description: string }>` — ordered subtask list
- `projectPaths: string[]` — project paths
- `boardId?: string` — optional board

Handler calls `createCluster` from task manager. Returns the created cluster ID and subtask count.

Register in `mcp-tools/index.ts`.

**Verify:** `npx tsc --noEmit` + `npm run transpile:electron`

---

### Task 7: IPC handlers for clusters

**Files:**
- Modify: `src/electron/handlers/ai-handlers.ts`
- Modify: `types/ipc.d.ts`
- Modify: `src/electron/preload.cts`

**Changes:**

Add IPC handler:

```typescript
aiCreateCluster: {
  args: [string, Array<{ title: string; description: string }>, AITaskProject[], string?]
  return: AITask
}
```

The handler calls `createCluster` and returns the parent task. Most existing IPC handlers already work because clusters are `AITask` objects — start, stop, move phase all operate on the active subtask through the lifecycle layer.

**Verify:** `npx tsc --noEmit` + `npm run transpile:electron`

---

### Task 8: Cluster card on kanban

**Files:**
- Modify: `src/ui/components/ai-automation/TaskCard.tsx`

**Changes:**

When rendering a cluster task (`task.isCluster`):
- Show cluster title
- Show active subtask name (from `task.subtasks[task.activeSubtaskIndex]`)
- Show progress: "2/5" badge
- Show current phase of the active subtask
- Different visual indicator (e.g., stacked card effect or cluster icon)

**Verify:** `npx tsc --noEmit`

---

### Task 9: Cluster expand overlay on kanban

**Files:**
- Create: `src/ui/components/ai-automation/ClusterOverlay.tsx`
- Modify: `src/ui/views/AIKanban.tsx`

**Changes:**

`ClusterOverlay` component:
- Receives: cluster task, anchor position (from the card's bounding rect)
- Renders a backdrop + vertical list of subtask mini-cards positioned below the anchor
- Each subtask card shows: title, phase badge, done checkmark
- Slide-down animation on open, slide-up on close
- Click subtask → navigate to task detail
- Click backdrop → close

In `AIKanban`:
- Add state for expanded cluster ID + anchor position
- On cluster card click: set expanded cluster, capture card position
- Render `ClusterOverlay` when a cluster is expanded

**Verify:** `npx tsc --noEmit`

---

### Task 10: Task detail view for cluster subtasks

**Files:**
- Modify: `src/ui/views/AITaskDetail.tsx`

**Changes:**

When viewing a cluster subtask:
- Add breadcrumb header: "Cluster: Feature X → Subtask 2: Implement API"
- The rest of the detail view works as normal (chat, diff, files, amendments)
- Diff viewer receives the `diffBaseline` for incremental diffs

Resolve which subtask to show:
- The route/selection passes the parent task ID
- The detail view reads `task.subtasks[task.activeSubtaskIndex]` to show the current subtask
- Or allow navigating to any subtask from the expand overlay

**Verify:** `npx tsc --noEmit`

---

### Task 11: Verify and test

**Verify:**
1. `npx tsc --noEmit`
2. `npm run transpile:electron`
3. `npm run lint`
4. `npm run build`

**Manual testing:**
1. Create a cluster via the planner (or manually via IPC)
2. Start the cluster — first subtask enters pipeline, agent works
3. Subtask completes pipeline → next subtask auto-starts
4. Review incremental diffs per subtask
5. Expand overlay on kanban shows all subtasks with status
6. Click subtask in overlay → task detail works
7. Stop/resume/interrupt work on cluster subtasks
8. All subtasks done → parent moves to DONE
