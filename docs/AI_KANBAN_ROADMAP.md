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

## Planned Features

- [ ] **F6**: Process Crash Recovery & Stall Detection — detect stale PIDs on startup (offer retry/rollback), runtime stall detection (no output for X min → kill + retry with exponential backoff)
- [ ] **F7**: Terminal Log Persistence — save agent output to log files, reload on task reopen
- [ ] **F8**: Notifications — system tray notifications, badge counts, in-app indicators
- [ ] **F9**: GitHub Integration — auto-create PRs, sync review comments via `gh` CLI
- [ ] **F10**: Cost & Usage Tracking — parse Claude output for token usage, aggregate per task
- [ ] **F11**: Import from External Trackers — import tickets from Jira (via MCP) or GitHub Issues (via `gh` CLI) into backlog
- [x] **F12**: General Review Comments & Resolved State — general feedback popover on Request Changes, resolve toggle on all comments, only unresolved sent to agents
- [x] **F14**: Large Diff Truncation — files with 200+ changed lines collapsed by default with "Load diff" button
- [ ] **F18**: Diff Virtualization — virtualized rendering for large diffs to avoid DOM performance issues
- [ ] **F19**: Agent Comment Resolution — allow agents to mark review comments as resolved after addressing them
- [ ] **F16**: Agent History Context — ensure each agent receives full task history so it doesn't redo completed work
- [ ] **F17**: Per-Phase Retry Limits — move maxReviewCycles from task to pipeline phase config (`maxRetries` per phase), track retries per-phase instead of globally, remove from task creation dialog

## Bugs & Fixes

_(None tracked yet)_

## Notes

- Design doc: `docs/plans/2026-03-06-ai-automation-kanban-design.md`
- Implementation plan: `docs/plans/2026-03-06-ai-automation-kanban-implementation.md`
- Pipeline design: `docs/plans/2026-03-07-customizable-pipeline-design.md`
- Knowledge docs design: `docs/plans/2026-03-07-auto-generate-knowledge-docs-design.md`
