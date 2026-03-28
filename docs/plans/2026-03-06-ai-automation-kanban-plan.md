# AI Automation Kanban — Implementation Plan

Reference: [Design Document](./2026-03-06-ai-automation-kanban-design.md)

---

## Phase 1: Data Layer & Basic UI Shell

**Goal**: Types, storage, IPC, and the kanban board with manual task management (no agents yet).

### Steps

1. **Define types** in `types.d.ts`
   - `AITask`, `AIAutomationSettings`, `KnowledgeDoc`, `ReviewComment`, `HumanComment`, `PipelinePhase`
   - Add to `EventPayloadMapping` for all new IPC channels

2. **Add storage schema** in `store.ts`
   - `aiTasks: AITask[]`
   - `aiAutomationSettings: AIAutomationSettings` with sensible defaults

3. **Create `src/electron/ai-automation/task-manager.ts`**
   - CRUD operations for tasks (create, update, delete, get, list)
   - Phase transition logic with validation (which transitions are allowed)
   - Phase history tracking
   - Emit task updates to renderer via IPC push

4. **Add IPC handlers** in `main.ts`
   - `getAITasks`, `createAITask`, `updateAITask`, `deleteAITask`, `moveAITaskPhase`
   - `getAISettings`, `updateAISettings`
   - `subscribeAITasks` (push on changes)

5. **Expose in preload** (`preload.cts`)

6. **Create UI context** `src/ui/contexts/ai-automation.tsx`
   - Subscribes to task updates
   - Provides task CRUD methods

7. **Create kanban board view** `src/ui/views/AIKanban.tsx`
   - 7 columns rendered from phase list
   - Task cards with title, phase badge
   - "New Task" dialog (title + description + git strategy + max review cycles)
   - Drag & drop between Backlog ↔ Todo

8. **Add top-level tab toggle**
   - Modify header bar to switch between current app and AI Kanban view
   - Add `AIAutomationProvider` to `App.tsx`

### Verification
- Can create tasks, see them on the board
- Can drag tasks between Backlog and Todo
- Tasks persist across app restarts

---

## Phase 2: Agent Runner — Spawning Claude Code

**Goal**: Spawn Claude Code CLI processes, pipe I/O, show terminal output.

### Steps

1. **Create `src/electron/ai-automation/agent-runner.ts`**
   - `spawnAgent(task, role, systemPrompt, workingDir)` — spawns `claude` CLI as child process
   - Pipes stdout/stderr to IPC channel for the task
   - Pipes stdin from IPC channel (user typing in terminal)
   - Tracks PID on the task
   - Handles process exit (success, error, crash)
   - Concurrency queue: maintains a queue of pending agent jobs, starts up to `maxConcurrency`

2. **Create `src/electron/ai-automation/prompt-builder.ts`**
   - `buildPrompt(task, phase, settings)` — assembles the 4-layer prompt
   - Reads global rules and phase-specific prompts from settings
   - Includes task description, plan (if exists), review comments (if exists)

3. **Add IPC for agent I/O**
   - `subscribeAITaskOutput(callback)` — streams `{ taskId, output }` to renderer
   - `sendAITaskInput(taskId, input)` — sends user input to agent's stdin
   - `stopAITask(taskId)` — kills the agent process

4. **Create task detail terminal tab** `src/ui/components/ai-automation/TaskTerminal.tsx`
   - xterm.js instance per task (reuse existing terminal patterns from Service view)
   - Subscribe to task output
   - Send user input on keypress

5. **Create task detail view** `src/ui/views/AITaskDetail.tsx`
   - Header with task info and controls
   - Tab layout: Terminal (this phase), Plan (placeholder), Diff (placeholder), History (placeholder)

6. **Wire up TODO → PLANNING auto-transition**
   - When a task moves to TODO, task-manager enqueues it
   - Agent runner picks it up, spawns planner agent
   - On process exit, parse output for plan, save to task, transition to IN_PROGRESS

### Verification
- Moving a task to Todo triggers Claude Code to spawn
- Terminal shows live Claude Code output
- User can type in terminal to respond to agent
- Process can be cancelled via stop button
- Concurrency limit is respected

---

## Phase 3: Full Pipeline — Planner → Worker → Reviewer

**Goal**: Complete the automated pipeline with all three agent roles.

### Steps

1. **Create `src/electron/ai-automation/worktree-manager.ts`**
   - `createWorktree(projectPath, branchName)` — creates git worktree + branch
   - `createBranch(projectPath, branchName)` — creates branch only
   - `cleanupWorktree(worktreePath)` — removes worktree after task completes
   - `getDiff(projectPath, branchName)` — gets diff against main branch

2. **Implement planner agent flow**
   - Planner prompt template: instructs agent to explore codebases, produce a structured plan, ask questions if unclear
   - On completion: extract plan from output, save to task, create branch/worktree, transition to IN_PROGRESS

3. **Implement worker agent flow**
   - Worker prompt template: instructs agent to implement the plan, commit changes
   - Runs in worktree/branch working directory
   - On completion: transition to AGENT_REVIEW

4. **Implement reviewer agent flow**
   - Reviewer prompt template: instructs agent to review the diff against plan and rules
   - On completion: parse approve/reject decision
   - If reject + cycles < max: transition to IN_PROGRESS with review comments
   - If approve or cycles >= max: transition to HUMAN_REVIEW

5. **Add "needs user input" detection**
   - Parse claude CLI output for patterns indicating agent is waiting
   - Set `needsUserInput` flag on task
   - Show notification badge on task card in kanban view

6. **Add Plan tab** in task detail view
   - Render plan markdown
   - Shown after planning phase completes

7. **Add History tab** in task detail view
   - Timeline of phase transitions with timestamps
   - Shows review cycle count

### Verification
- A task moves through the full pipeline: TODO → PLANNING → IN_PROGRESS → AGENT_REVIEW → HUMAN_REVIEW
- Worker creates commits on the correct branch/worktree
- Reviewer can reject and send back to worker with comments
- Review cycle limit is enforced
- Notification badge appears when agent needs input

---

## Phase 4: Human Review — Diff Viewer with Inline Comments

**Goal**: Build the diff viewer UI for the human review phase.

### Steps

1. **Create `src/electron/ai-automation/diff-parser.ts`**
   - Parse unified diff output into structured data: `{ files: [{ path, status, hunks: [{ lines }] }] }`
   - Handle added, modified, deleted files

2. **Add IPC handler** `getAITaskDiff(taskId)` — returns parsed diff

3. **Create diff viewer components**
   - `src/ui/components/ai-automation/DiffViewer.tsx` — main container
   - `src/ui/components/ai-automation/DiffFileTree.tsx` — sidebar file list with change counts
   - `src/ui/components/ai-automation/DiffFile.tsx` — single file diff (unified view first, side-by-side later)
   - `src/ui/components/ai-automation/DiffComment.tsx` — inline comment display + input

4. **Display agent review comments** on the diff
   - Map `ReviewComment` objects to their file/line positions
   - Render inline on the diff

5. **Human commenting**
   - Hover on diff line → "+" button → comment input
   - Comments saved to task as `HumanComment[]`

6. **Approve/Reject actions**
   - Approve button → task transitions to DONE
   - Request Changes button → comments serialized, task transitions to IN_PROGRESS
   - Worker agent receives human comments as additional context

### Verification
- Diff viewer shows all changed files correctly
- Agent review comments display inline
- User can add inline comments
- Approve moves to DONE
- Request Changes sends task back with comments

---

## Phase 5: Knowledge Docs & Settings UI

**Goal**: Settings UI for knowledge docs, phase prompts, global rules, and general settings.

### Steps

1. **Create settings view** `src/ui/views/AISettings.tsx`
   - Tabbed layout: Knowledge Docs | Phase Prompts | Global Rules | General

2. **Knowledge Docs tab**
   - List of docs with title, last updated, auto-generated badge
   - Create/edit/delete docs (markdown editor)
   - "Auto-generate" button: opens dialog to specify project directories, spawns Claude Code agent to explore and produce a knowledge doc

3. **Phase Prompts tab**
   - Text editor for each phase prompt (planning, working, reviewing)
   - Default templates provided, user can customize

4. **Global Rules tab**
   - Markdown editor for always-applied rules

5. **General tab**
   - Max concurrency slider (1-5)
   - Default max review cycles (1-10)
   - Default git strategy (worktree/branch/none)

6. **Implement auto-generate knowledge doc**
   - IPC handler: receives list of project paths
   - Spawns Claude Code with prompt to explore the projects and describe the architecture
   - Streams output to a terminal dialog
   - On completion: saves generated markdown as a KnowledgeDoc

### Verification
- Settings persist across restarts
- Knowledge docs can be created, edited, deleted
- Auto-generate explores projects and produces useful docs
- Phase prompts are used when spawning agents
- Concurrency limit changes take effect immediately

---

## Phase 6: Polish & Robustness

**Goal**: Error handling, edge cases, UX improvements.

### Steps

1. **Process crash recovery**
   - On app startup, check for tasks stuck in agent phases with no running process
   - Offer to retry or move back to previous phase

2. **Task cancellation**
   - Cancel button kills process, resets task to previous manual phase
   - Cleanup worktree if task is cancelled

3. **Terminal scrollback & persistence**
   - Save terminal output to log files (like existing service logs)
   - Load previous output when reopening a task

4. **Kanban UX polish**
   - Task card hover previews
   - Filter/search tasks
   - Collapse Done column
   - Keyboard shortcuts

5. **Notifications**
   - System tray notification when agent needs input
   - Badge count on the AI Kanban tab toggle

6. **Validate claude CLI availability**
   - On first use, check if `claude` is installed and in PATH
   - Show setup instructions if not found

### Verification
- App handles crashes gracefully
- Cancelled tasks clean up properly
- Terminal history is preserved
- UI feels responsive with many tasks

---

## Future Phases (Not in v1)

### Phase 7: Customizable Pipeline
- UI to add/remove/reorder pipeline phases
- Configure each phase as manual or agent
- Custom agent prompts per phase
- Save pipeline presets

### Phase 8: Side-by-Side Diff View
- Toggle between unified and side-by-side diff
- Syntax highlighting in diff viewer

### Phase 9: GitHub Integration
- Auto-create PR when task reaches HUMAN_REVIEW or DONE
- Sync review comments with GitHub PR comments
- Link tasks to GitHub issues

### Phase 10: Task Templates & Dependencies
- Predefined task types (bug fix, feature, refactor) with template prompts
- Task dependency graph (task B blocked by task A)

### Phase 11: Agent Memory & Learning
- Persistent learnings across tasks
- Track what approaches worked/failed
- Agent can reference past task outcomes

### Phase 12: Cost & Usage Tracking
- Track token usage per task/phase
- Cost estimates and budgets
- Usage dashboard

### Phase 13: Desktop Notifications & External Integrations
- OS-level notifications when tasks need attention
- Slack/Discord webhooks for task status changes
- Email notifications
