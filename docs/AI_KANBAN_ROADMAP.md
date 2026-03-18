# AI Automation Kanban — Roadmap

## Completed

- [x] **Tasks 1-10**: Core implementation (types, storage, task manager, IPC, preload, UI context, kanban board, agent runner, task detail, settings)
- [x] **F1**: Worktree Manager — git worktree creation, branch management, diff retrieval
- [x] **F2**: Diff Parser & Viewer — structured diff display in task detail
- [x] **F3**: Human Review with Inline Comments — line-level commenting on diffs, request changes flow
- [x] **F4**: Auto-Generate Knowledge Docs — Claude explores codebase, generates structured markdown
- [x] **F5**: Customizable Pipeline — user-configurable phases replacing hardcoded columns
- [x] **F15**: Edit Task & Workspace Restructure — edit task in BACKLOG, file attachments (create + detail), per-task workspace dirs, configurable taskDataRoot, worktrees array migration
- [x] **F13**: Task File Management — never-overwrite rule with numbered suffixes, phase cycle count in prompts, file include/exclude toggles, delete agent files, description in TaskFilesTab
- [x] **F20**: Agent Security — role-based tool restriction per phase, PreToolUse guard hook for directory boundary enforcement, phase templates
- [x] **F24**: Task Amendments — add new requirements to existing/completed tasks, send back to any pipeline phase, amendments tab + quick-action header button, prompt builder includes amendments for agent context

## Planned Features

- [ ] **F6**: Process Crash Recovery & Stall Detection — detect stale PIDs on startup (offer retry/rollback), runtime stall detection (no output for X min → kill + retry with exponential backoff)
- [ ] **F7**: Terminal Log Persistence — save agent output to log files, reload on task reopen
- [ ] **F8**: Notifications — system tray notifications, badge counts, in-app indicators
- [ ] **F10**: Cost & Usage Tracking — parse Claude output for token usage, aggregate per task
- [ ] **F11**: Import from External Trackers — import tickets from Jira (via MCP) or GitHub Issues (via `gh` CLI) into backlog
- [x] **F12**: General Review Comments & Resolved State — general feedback popover on Request Changes, resolve toggle on all comments, only unresolved sent to agents
- [x] **F14**: Large Diff Truncation — files with 200+ changed lines collapsed by default with "Load diff" button
- [ ] **F18**: Diff Virtualization — virtualized rendering for large diffs to avoid DOM performance issues
- [ ] **F19**: Agent Comment Resolution — allow agents to mark review comments as resolved after addressing them
- [ ] **F16**: Agent History Context — ensure each agent receives full task history so it doesn't redo completed work
- [ ] **F17**: Per-Phase Retry Limits — move maxReviewCycles from task to pipeline phase config (`maxRetries` per phase), track retries per-phase instead of globally, remove from task creation dialog
- [ ] **F22**: Diff Viewer Search — search across all diff content with match highlighting, result count, and prev/next navigation
- [ ] **F23**: Continue Task — allow resuming a task from any phase (including DONE), re-enter the pipeline at a chosen phase with existing context, worktrees, and history preserved
- [ ] **F25**: Agent Context Control — manage and limit the context sent to agents (prompt size budgets, smart truncation, section prioritization) to prevent context window overflow as tasks accumulate amendments, comments, files, and history
- [ ] **F26**: Base Branch Autocomplete — fetch actual git branches from project repos and show autocomplete dropdown in task creation and edit forms for the base branch field
- [ ] **F27**: Agent Terminal Filtering — clean up agent terminal output with toggleable filters to hide tool usage blocks, system messages, and other noise, showing only meaningful agent output and conversation
- [ ] **F28**: Agent Terminal Enhancement — color-coded terminal output (distinguish agent responses, tool calls, errors, system messages), info header showing current agent context (active phase, task summary, worktree path, cycle count, elapsed time)
- [x] **F29**: Amendment Project Management — allow adding/removing projects and worktrees from within the amendment form, so users can expand task scope (new repos, new worktrees) alongside new requirements without going through task edit
- [ ] **F30**: Partial Knowledge Docs — allow selectively including knowledge docs per task or per phase instead of always sending all docs, reducing context usage for tasks that only need specific project knowledge
- [ ] **F31**: Scoped Knowledge Doc Generation — allow users to generate a knowledge doc from a specific directory with a custom prompt (e.g., "document the auth module in src/auth"), producing focused docs instead of whole-project scans
- [ ] **F32**: Image Paste Support — allow pasting/dropping images in comments, amendments, task descriptions, and attachments; store as files in task directory and include in agent context as vision inputs
- [ ] **F33**: Multiple Boards — allow creating and switching between separate kanban boards, each with its own tasks, pipeline, and settings, for organizing work across different projects or teams
- [ ] **F34**: Unified Theme — apply the AI kanban warm charcoal design system (palette, typography, component styling) to the original DevControl views (services, databases, Docker, API client, etc.)
- [ ] **F35**: Kanban as Main View — restructure the app so the kanban board is the primary landing page, with DevControl tools (services, databases, Docker, queues, etc.) accessible as integrated panels or tabs within it, replacing the current toggle between two separate modes
- [ ] **F36**: AI Task Planner — user describes a goal in natural language, an agent analyzes the codebase and breaks it down into multiple tasks with titles, descriptions, project assignments, and suggested pipeline phases, auto-creating them in the backlog
- [ ] **F37**: Archive Management — allow archiving completed/old tasks to reduce clutter on the board, with a separate archive view to browse, search, and restore archived tasks
- [ ] **F38**: Worktree Lifecycle Hooks — configurable pre- and post-worktree-creation commands per project (e.g., `npm install`, `cp .env.example .env`, run migrations), executed automatically when a worktree is created for a task

## Design Documents

- Amendments design: `docs/plans/2026-03-10-task-amendments-design.md`

## Bugs & Fixes

- [ ] **B1**: Stop button not working properly — clicking Stop doesn't reliably kill the running agent process
- [ ] **B2**: Silent phase errors — when a phase fails to start (e.g., spawn error, invalid args), there is no UI indication; the task just stops with no error message shown to the user
- [ ] **B3**: Git section shows unrelated commits — the branch info in task details shows commits that don't belong to the task's branch (likely showing all commits instead of only those since branching from base)

## Notes

- Design doc: `docs/plans/2026-03-06-ai-automation-kanban-design.md`
- Implementation plan: `docs/plans/2026-03-06-ai-automation-kanban-implementation.md`
- Pipeline design: `docs/plans/2026-03-07-customizable-pipeline-design.md`
- Knowledge docs design: `docs/plans/2026-03-07-auto-generate-knowledge-docs-design.md`
- Agent security design: `docs/plans/2026-03-09-agent-security-design.md`
