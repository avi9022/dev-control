# F15: Edit Task & Task Workspace Restructure — Design Document

## Overview

Consolidate all task-related data (agent files, user attachments, worktrees) into a single per-task workspace directory. Add the ability to edit tasks in BACKLOG, attach files, and configure the task data root directory. Remove deprecated fields from the hardcoded pipeline era.

## Data Model Changes

### AITask

Remove:
- `worktreePath?: string`
- `worktreeDir?: string`
- `maxReviewCycles: number`
- `reviewCycleCount: number`

Add:
- `worktrees: AITaskWorktree[]`

```typescript
interface AITaskWorktree {
  projectPath: string    // source repo path
  worktreePath: string   // path inside task workspace
  branchName: string     // git branch name
}
```

### AIAutomationSettings

Remove:
- `defaultWorktreeDir: string`
- `defaultMaxReviewCycles: number`

Add:
- `taskDataRoot?: string` — optional override, defaults to `{userData}/ai-task-data`

### NewTaskDialog

Remove:
- `maxReviewCycles` field
- `worktreeDir` field

## Task Directory Structure

```
{taskDataRoot}/{taskId}/
├── agent/          # Agent-created files (plan, review notes, etc.)
├── attachments/    # User-uploaded files
└── worktrees/      # Git worktrees (one per project)
    └── <repo-name>/
```

Default `taskDataRoot`: `{app.getPath('userData')}/ai-task-data`

## Edit Task

### Rules
- Editing only allowed when task is in BACKLOG phase
- Agent-running check not needed (agents don't run in BACKLOG)

### Editable Fields
- Title (text input)
- Description (textarea)
- Project paths (add/remove with folder picker)
- Git strategy (select)
- Base branch (text input)

### Non-Editable Fields
- Phase, created date, worktree info, branch name (system-managed)

### UX Flow
1. Task detail "Task" tab shows read-only view (current behavior)
2. If task is in BACKLOG, "Edit" button appears in header
3. Click Edit → fields become inputs, button becomes "Save" + "Cancel"
4. Save calls existing `aiUpdateTask(id, updates)`, exits edit mode
5. Cancel discards changes, exits edit mode

No new IPC handlers needed for editing.

## User File Attachments

### Attach Flow
- "Attach Files" button on Task tab (available in any phase, not just BACKLOG)
- Opens native file picker (multi-select)
- Files copied into `{taskDataRoot}/{taskId}/attachments/`

### Display
- "Task Files" tab shows two sections:
  - **Attachments** — user files, deletable
  - **Agent Files** — from `agent/` subdirectory, read-only

### Agent Context
- `prompt-builder.ts` reads `attachments/` and includes content in agent prompts
- Large files: include first N lines with a note about truncation

### New IPC Handlers
- `aiAttachTaskFiles(taskId: string, filePaths: string[]): Promise<string[]>` — copies files, returns filenames
- `aiDeleteTaskAttachment(taskId: string, filename: string): Promise<void>`

## Task Dir Manager Refactor

### Updated Functions
- `getOrCreateTaskDir(taskId)` — reads `taskDataRoot` from settings, falls back to default
- `getAgentDir(taskId)` — returns `{taskDir}/agent/`, creates if needed
- `getAttachmentsDir(taskId)` — returns `{taskDir}/attachments/`, creates if needed
- `getWorktreesDir(taskId)` — returns `{taskDir}/worktrees/`, creates if needed
- `listTaskDirFiles(taskId)` — reads from `agent/` subdirectory
- `readTaskDirFile(taskId, filename)` — reads from `agent/` subdirectory
- `attachFiles(taskId, filePaths)` — copies files into `attachments/`
- `deleteAttachment(taskId, filename)` — removes from `attachments/`
- `listAttachments(taskId)` — lists files in `attachments/`

### Worktree Manager Changes
- Worktrees created at `{taskDir}/worktrees/<repo-name>/`
- Remove custom worktree directory logic
- `createWorktree` takes taskId, resolves path from task dir

## Settings UI Changes

### Remove from GeneralTab
- "Default Worktree Directory" input + folder picker
- "Default Max Review Cycles" input

### Add to GeneralTab
- "Task Data Directory" — input + folder picker
- Placeholder shows default path
- Changing only affects new tasks

### Remove from NewTaskDialog
- `maxReviewCycles` field
- `worktreeDir` field

## Migration

Runs on app startup in `task-manager.ts`:

### Task Migration
For each existing task:
1. If `worktreePath` exists and `projectPaths[0]` exists:
   - Convert to `worktrees: [{ projectPath: projectPaths[0], worktreePath, branchName }]`
   - Note: existing worktree stays at its current path (moving requires `git worktree move` with source repo access — not guaranteed). New worktrees will use the new structure.
2. Move loose files from `{taskId}/` root into `{taskId}/agent/` (skip directories)
3. Remove deprecated fields: `worktreePath`, `worktreeDir`, `maxReviewCycles`, `reviewCycleCount`

### Settings Migration
- Remove `defaultWorktreeDir` from settings
- Remove `defaultMaxReviewCycles` from settings
