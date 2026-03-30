# Task Clusters — Design

## Overview

A cluster is a parent task with ordered subtasks that share a worktree and branch. The kanban shows one card per cluster. Each subtask runs through the full pipeline independently. When a subtask is approved, the next one auto-starts. The user reviews smaller, focused diffs at each step instead of one massive change.

## Problem

Large features produce large diffs that are hard to review. Splitting into independent tasks loses the shared context and worktree. Task clusters let the planner break a feature into ordered steps that share a branch, auto-advance on approval, and show incremental diffs.

## Data Model

### Parent Task (AITask)

Existing `AITask` gets new optional fields:

```typescript
isCluster?: boolean
subtasks?: AISubtask[]
activeSubtaskIndex?: number
```

The parent owns: worktree, projects, taskDirPath, boardId. Subtasks inherit these.

### Subtask

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

Key differences from `AITask`:
- No `projects`, `worktrees`, `boardId` — inherited from parent
- Has `diffBaseline` — commit hash from when the previous subtask completed, used for incremental diffs
- Has its own `taskDirPath` — subdirectory under the parent's task dir for context history, agent files

## Kanban Behavior

### Card Display

One card per cluster. Shows:
- Cluster title
- Active subtask name
- Progress indicator (e.g., "2/5")
- Current phase of the active subtask

### Card Position

The cluster card sits in the column matching the active subtask's current phase. When the subtask moves phases, the card moves. When a new subtask starts, the card moves back to the first pipeline phase.

### Expand Interaction

Click the cluster card → subtask cards animate downward from the parent card position. A backdrop overlay darkens the rest of the board. Each subtask card shows:
- Title
- Status (pending / phase name / done)

Click a subtask → navigates to the task detail view. Click backdrop → collapses back to single card.

## Worktree

- One worktree, one branch for the entire cluster
- Created when the first subtask starts (same as normal task worktree creation)
- All subtasks work in the same worktree directory
- The parent task's `worktrees` array holds the shared worktree info

## Diff Baseline

When subtask N completes (reaches DONE):
1. Record the current HEAD commit hash as `diffBaseline` on subtask N+1
2. When viewing subtask N+1's diff, show `git diff <diffBaseline>..HEAD`
3. Subtask 1 has no baseline — its diff is relative to the branch creation point (same as a normal task)

This ensures each review shows only the changes from that specific subtask.

## Agent Context

Each subtask's agent receives:
- The subtask's own description (primary context)
- Cluster context section in the prompt:
  - Parent cluster title
  - Total subtask count
  - List of completed subtasks (title only)
  - Current subtask number
  - List of upcoming subtasks (title only)
- No diffs or detailed output from other subtasks (context window budget)

## Auto-Advance

When a subtask reaches DONE:
1. Save HEAD commit hash as `diffBaseline` on the next subtask
2. Set `activeSubtaskIndex` to the next subtask
3. Move the next subtask's phase to the first pipeline phase
4. Enqueue the next subtask for agent processing
5. The cluster card moves to the first pipeline phase column

When the last subtask reaches DONE:
1. The parent cluster moves to DONE
2. At this point the branch has all changes from all subtasks — ready for a single PR

## Task Detail View

When viewing a cluster subtask:
- The task detail view works exactly like a normal task
- Chat view shows that subtask's agent conversations
- Diff viewer shows changes relative to `diffBaseline`
- All standard controls (stop, resume, amend, etc.) work on the subtask
- A breadcrumb or header indicates "Cluster: Feature X → Subtask 2: Implement API"

## Planner Integration

New MCP tool: `create_cluster`

```typescript
{
  name: 'create_cluster',
  description: 'Create a task cluster — a parent task with ordered subtasks that share a worktree',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Cluster title (the feature name)' },
      subtasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['title', 'description'],
        },
        description: 'Ordered list of subtasks',
      },
      projectPaths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Project paths for the cluster',
      },
      boardId: { type: 'string', description: 'Board to create the cluster on' },
    },
    required: ['title', 'subtasks', 'projectPaths'],
  },
}
```

## What Doesn't Change

- Pipeline definition and phase routing
- Board structure
- Agent spawning mechanism (spawn/resume/interrupt)
- MCP server and existing tools
- Worktree creation logic (just called once for the cluster)
- Notification system
