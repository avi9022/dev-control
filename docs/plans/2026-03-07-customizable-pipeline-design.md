# Customizable Pipeline Phases — Design Document

## Goal

Replace hardcoded AI automation phases with a user-configurable ordered pipeline. Users can add, remove, reorder, and configure phases — each either an AI agent step or a manual human step.

## Architecture

Fixed endpoints (BACKLOG, DONE) bookend a user-defined ordered list of pipeline phases. Each phase is either `agent` (spawns Claude with a custom prompt) or `manual` (waits for user action). Agent phases can route tasks backward on rejection via output pattern matching.

A per-task workspace directory (`{userData}/ai-task-data/{taskId}/`) persists across all phases, replacing the special `task.plan` field. Agents read/write files there (plan.md, review.md, etc.) and each spawned agent gets access via `--add-dir`.

## Data Model

### AIPipelinePhase

```typescript
interface AIPipelinePhase {
  id: string                  // UUID
  name: string                // Display name (e.g. "Planning", "Code Review")
  type: 'agent' | 'manual'
  prompt?: string             // System prompt for agent phases
  allowedTools?: string       // Tool restrictions for agent phases (e.g. "Read,Glob,Grep,Bash(git:*)")
  rejectPattern?: string      // Output string that triggers reject routing (e.g. "REVIEW_DECISION: REJECT")
  rejectTarget?: string       // Phase ID to route to on reject match
}
```

### Settings Changes

```typescript
interface AIAutomationSettings {
  maxConcurrency: number
  defaultMaxReviewCycles: number      // Deprecated — reject loops are now per-phase
  defaultGitStrategy: AIGitStrategy
  defaultBaseBranch: string
  defaultWorktreeDir: string
  pipeline: AIPipelinePhase[]         // NEW — ordered pipeline phases
  globalRules: string
  knowledgeDocs: AIKnowledgeDoc[]
  // REMOVED: phasePrompts (migrated into pipeline phase prompts)
}
```

### Task Changes

```typescript
interface AITask {
  id: string
  title: string
  description: string
  phase: string               // CHANGED from AITaskPhase union → phase ID, 'BACKLOG', or 'DONE'
  taskDirPath?: string        // NEW — path to task workspace directory
  // REMOVED: plan (replaced by files in task directory)
  // REMOVED: currentAgentRole (look up phase type from config)
  // ...rest unchanged
}
```

### Types Removed

- `AITaskPhase` union type → becomes `string`
- `AIAgentRole` union type → removed entirely

## Default Pipeline

Ships pre-configured to reproduce current behavior:

| Order | Name          | Type   | Tools                                              | Reject Pattern             | Reject Target |
|-------|---------------|--------|-----------------------------------------------------|----------------------------|---------------|
| 1     | Planning      | agent  | Read,Glob,Grep,Bash(find:*),Bash(ls:*),Bash(cat:*),Bash(git:*) | —              | —             |
| 2     | In Progress   | agent  | (all)                                                | —                          | —             |
| 3     | Agent Review  | agent  | Read,Glob,Grep,Bash(git:*),Bash(diff:*)             | REVIEW_DECISION: REJECT    | In Progress   |
| 4     | Human Review  | manual | —                                                    | —                          | —             |

## Runtime Behavior

### Agent Spawning (Generic)

For any agent phase:
1. Read phase config from `settings.pipeline`
2. Build system prompt: phase prompt + global rules + knowledge docs + task context
3. Build message: task description + list of files in task directory
4. Set `allowedTools` from phase config (if specified)
5. Set cwd: worktree path > project path > task directory
6. Pass task directory via `--add-dir`
7. Spawn claude

### Completion Handling (Generic)

When agent finishes:
1. If `rejectPattern` exists and output contains it → move to `rejectTarget`, enqueue
2. Otherwise → move to next phase in pipeline order, enqueue
3. If next phase is `manual` → stop (wait for user)
4. If no next phase → move to DONE

### Worktree Creation

Happens once, on first transition from BACKLOG into the first pipeline phase (when git strategy is worktree).

### Task Directory

- Created at `{userData}/ai-task-data/{taskId}/` when task first enters an agent phase
- Included in every agent spawn via `--add-dir`
- Mentioned in prompt so agents know to read/write files there
- Cleaned up when task is deleted

## UI Changes

### Settings — Pipeline Tab

- Ordered list of phases between fixed BACKLOG and DONE labels
- Each phase is an expandable card
- Fields: name, type (agent/manual dropdown), prompt (textarea), allowed tools (input), reject pattern (input), reject target (dropdown of other phases)
- Add/remove/reorder (drag or up/down buttons)

### Kanban Board

- Columns rendered dynamically: BACKLOG + pipeline phases + DONE
- Column headers from phase config names

### Task Detail

- "Plan" tab → "Task Files" tab showing contents of task directory
- Phase labels use names from pipeline config

## Migration Strategy

### Phase ID Mapping

Default pipeline phase IDs use predictable values: `planning`, `in-progress`, `agent-review`, `human-review`. Existing tasks with phase values like `PLANNING`, `IN_PROGRESS`, `AGENT_REVIEW`, `HUMAN_REVIEW` are mapped on load:
- `PLANNING` → `planning`
- `IN_PROGRESS` → `in-progress`
- `AGENT_REVIEW` → `agent-review`
- `HUMAN_REVIEW` → `human-review`
- `BACKLOG` and `DONE` stay as-is

### Settings Migration

On first load when `settings.pipeline` is undefined:
1. Create default pipeline
2. Copy `phasePrompts.planning` → Planning phase prompt (if non-empty)
3. Copy `phasePrompts.working` → In Progress phase prompt (if non-empty)
4. Copy `phasePrompts.reviewing` → Agent Review phase prompt (if non-empty)

### Backwards Compatibility

- `task.plan` kept on type but deprecated — new agent phases use task directory
- `phasePrompts` kept in store schema but ignored by runtime
- Existing tasks with old phase names are remapped on load

## Future Features (Not Implemented Now)

- Multiple routing targets based on different output patterns
- Customizable terminal states (multiple done statuses)
- Pipeline templates/presets
- Phase-level max retry count (replace global `defaultMaxReviewCycles`)
