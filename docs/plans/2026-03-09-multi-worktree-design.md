# Multi-Worktree Support Design

## Problem

Currently the system creates a worktree only for the first tagged project. Tasks that span multiple projects need per-project worktree configuration with individual branch names and base branches. Read-only reference projects should be accessible without creating a worktree.

## Goal

Allow per-project git strategy configuration: each tagged project can be set to "worktree" (creates an isolated copy for modifications) or "none" (read-only access to original path).

## Data Model

### New type: `AITaskProject`

```typescript
interface AITaskProject {
  path: string
  label: string
  gitStrategy: AIGitStrategy    // 'worktree' | 'none'
  baseBranch?: string           // only if worktree
  customBranchName?: string     // only if worktree
}
```

### AITask changes

- **Add:** `projects: AITaskProject[]`
- **Remove (deprecated):** `projectPaths`, `gitStrategy`, `baseBranch`, `customBranchName`
- **Keep:** `worktrees: AITaskWorktree[]` (populated at runtime)

### IPC changes

`aiCreateTask` signature changes to accept `AITaskProject[]` instead of flat params.

## Agent Runner

1. Loop through `task.projects` where `gitStrategy === 'worktree'`
2. Create a worktree for each inside `ai-task-data/{taskId}/worktrees/{repoName}`
3. First worktree becomes CWD
4. Additional worktrees passed via `--add-dir`
5. Read-only projects passed via `--add-dir`

## Guard Script (Security)

Environment variables:
- `ALLOWED_WRITE_DIR` — task data dir (`ai-task-data/{taskId}/`)
- `ALLOWED_READ_DIRS` — comma-separated: task dir + all read-only project paths

Guard rules:
- **Edit/Write** → must be inside `ALLOWED_WRITE_DIR`
- **Read/Grep/Glob** → allowed inside `ALLOWED_WRITE_DIR` OR any `ALLOWED_READ_DIRS` entry

## Prompt Builder

Security boundary section lists:
- "You may modify files in: {worktree paths}"
- "You may read files in: {read-only project paths}"

## New Task Dialog

When projects are tagged, each appears as a config card:
- Project label + remove button
- Git strategy dropdown (Worktree / None)
- Branch name input (only if Worktree, auto-generated if empty)
- Base branch input (only if Worktree, defaults to global setting)

Helper text above cards: "Tagged projects are available to the agent. Set Worktree to create an isolated copy for modifications, or None for read-only access."

Task-level git strategy, branch name, and base branch fields are removed.

Default git strategy for newly tagged projects: from `settings.defaultGitStrategy`.

## Migration

Existing tasks with old fields get converted on read:
- First project gets task-level `baseBranch` and `customBranchName`
- All projects get task-level `gitStrategy`
- `label` derived from path basename
- Old fields left on object (ignored, safe for downgrade)
