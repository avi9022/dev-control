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
- [x] **F12**: General Review Comments & Resolved State — general feedback popover on Request Changes, resolve toggle on all comments, only unresolved sent to agents
- [x] **F14**: Large Diff Truncation — files with 200+ changed lines collapsed by default with "Load diff" button
- [x] **F29**: Amendment Project Management — allow adding/removing projects and worktrees from within the amendment form, so users can expand task scope (new repos, new worktrees) alongside new requirements without going through task edit
- [x] **F6**: Process Crash Recovery & Stall Detection — detect stale PIDs on startup (offer retry/rollback), runtime stall detection (no output for X min → kill + retry with exponential backoff)
- [x] **F7**: Terminal Log Persistence — save agent output to log files, reload on task reopen
- [x] **F8**: Notifications — system tray notifications, badge counts, in-app indicators
- [x] **F19**: Agent Comment Resolution — allow agents to mark review comments as resolved after addressing them via MCP tools
- [x] **F22**: Diff Viewer Search — search across all diff content with match highlighting, result count, and prev/next navigation
- [x] **F23**: Continue Task — allow resuming a task from any phase (including DONE), re-enter the pipeline at a chosen phase with existing context, worktrees, and history preserved
- [x] **F33**: Multiple Boards — allow creating and switching between separate kanban boards, each with its own tasks and pipeline, for organizing work across different projects or teams
- [x] **F34**: Unified Theme — apply the AI kanban warm charcoal design system (palette, typography, component styling) to the original DevControl views (services, databases, Docker, API client, etc.)
- [x] **F35**: Kanban as Main View — restructure the app so the kanban board is the primary landing page, with DevControl tools (services, databases, Docker, queues, etc.) accessible as integrated panels or tabs within it, replacing the current toggle between two separate modes
- [x] **F46**: Task Cross-References — `#shortId` syntax in descriptions and amendments, autocomplete dropdown, clickable chips in task detail, Related Tasks section in agent prompts with truncated description + task directory path for on-demand exploration

## Planned Features

- [ ] **F11**: Import from External Trackers — import tickets from Jira (via MCP) or GitHub Issues (via `gh` CLI) into backlog
- [ ] **F18**: Diff Virtualization — virtualized rendering for large diffs to avoid DOM performance issues
- [ ] **F17**: Per-Phase Retry Limits — move maxReviewCycles from task to pipeline phase config (`maxRetries` per phase), track retries per-phase instead of globally, remove from task creation dialog
- [ ] **F25**: Agent Context Control — manage and limit the context sent to agents (prompt size budgets, smart truncation, section prioritization) to prevent context window overflow as tasks accumulate amendments, comments, files, and history
- [ ] **F26**: Base Branch Autocomplete — fetch actual git branches from project repos and show autocomplete dropdown in task creation and edit forms for the base branch field
- [ ] **F27**: Agent Terminal Filtering — clean up agent terminal output with toggleable filters to hide tool usage blocks, system messages, and other noise, showing only meaningful agent output and conversation
- [ ] **F28**: Agent Terminal Enhancement — color-coded terminal output (distinguish agent responses, tool calls, errors, system messages), info header showing current agent context (active phase, task summary, worktree path, cycle count, elapsed time)
- [ ] **F30**: Partial Knowledge Docs — allow selectively including knowledge docs per task or per phase instead of always sending all docs, reducing context usage for tasks that only need specific project knowledge
- [ ] **F31**: Scoped Knowledge Doc Generation — allow users to generate a knowledge doc from a specific directory with a custom prompt (e.g., "document the auth module in src/auth"), producing focused docs instead of whole-project scans
- [ ] **F32**: Image Paste Support — allow pasting/dropping images in comments, amendments, task descriptions, and attachments; store as files in task directory and include in agent context as vision inputs
- [ ] **F36**: AI Task Planner — user describes a goal in natural language, an agent analyzes the codebase and breaks it down into multiple tasks with titles, descriptions, project assignments, and suggested pipeline phases, auto-creating them in the backlog
- [ ] **F37**: Archive Management — allow archiving completed/old tasks to reduce clutter on the board, with a separate archive view to browse, search, and restore archived tasks
- [ ] **F38**: Worktree Lifecycle Hooks — configurable pre- and post-worktree-creation commands per project (e.g., `npm install`, `cp .env.example .env`, run migrations), executed automatically when a worktree is created for a task
- [ ] **F39**: VS Code Integration — open task worktrees directly in VS Code, sync task context (comments, amendments) as VS Code workspace data, quick-action commands from the editor
- [ ] **F40**: Browser Extension — browser companion that shows running task status, notifications, and quick actions (approve, reject, view diff) without switching to the app
- [ ] **F41**: Advanced Task Filtering — SQL-like query language for filtering tasks (e.g., `phase = "in-progress" AND project = "api" AND has:comments`, `created > 7d ago AND NOT resolved`), with saved filters and quick filter presets on the kanban board
- [ ] **F42**: 3D Task Visualization — fun alternative view that renders tasks as characters in a Minecraft-style voxel world, where agents visually perform their work (planning agent reads blueprints, worker agent builds structures, reviewer agent inspects buildings), with task progress reflected as construction progress and phase transitions as movement between zones (sub-roadmap: `docs/F42_3D_VISUALIZATION_ROADMAP.md`)
- [ ] **F43**: Code Quality & Linting Rules — establish and enforce project-wide coding standards with ESLint rules, run a full codebase quality assessment, fix inconsistencies (naming, patterns, dead code, error handling), and document conventions in CLAUDE.md
- [ ] **F44**: Codebase Audit & Refactor — comprehensive review of the entire codebase for code quality, performance, accessibility, and maintainability; identify tech debt, refactor large files, extract shared utilities, and ensure consistent patterns across all modules
- [ ] **F45**: MCP Agent Permissions — granular permission system for MCP tools per agent/phase, controlling which tools each agent can access (e.g., read-only for reviewers, no shell for planners), with a UI to configure permissions per pipeline phase and audit logs of tool usage
- [ ] **F47**: Mobile App — companion mobile app (React Native or similar) to monitor and control your workflow from your phone. View kanban boards, receive push notifications for agent events (task completed, needs attention, review ready), approve/reject tasks, view diffs, drag tasks between phases, and trigger agent runs. Connects to the desktop app via local network or cloud sync.
- [ ] **F48**: Task Dependencies — allow marking tasks as blocked by other tasks, so a task waits until its dependencies are complete before it can proceed through the pipeline. Visual dependency indicators on the kanban board, automatic unblocking when upstream tasks reach DONE, and optional auto-start of the next pipeline phase when unblocked.
- [ ] **F49**: Phase Agent Skills & Scripts — allow attaching custom skills (markdown instruction files) and scripts (shell commands) to pipeline phase agents. Skills are injected into the agent's system prompt as additional context/instructions. Scripts run before or after the agent (pre/post hooks per phase). Configurable per phase in the pipeline editor UI.
- [ ] **F50**: Enhanced Service Terminal — replace the basic terminal with a full-featured xterm.js terminal for services, with proper PTY support, scrollback, search, copy/paste, clickable links, and theme integration matching the app's dark/light mode
- [ ] **F51**: Service Groups & Categories — allow organizing services into named groups/categories (e.g., "Backend", "Frontend", "Infrastructure"), with collapsible group headers in the sidebar, bulk start/stop per group, and drag-and-drop reordering between groups
- [ ] **F52**: MCP Worktree Tool — add an MCP tool that allows agents to create, list, and manage git worktrees for tasks. Agents can request a new worktree for a specific project/branch without user intervention, useful for planning agents that break work into tasks needing isolated workspaces.
- [ ] **F53**: Kanban Sorting — add sorting options to kanban columns (by creation date, last updated, priority, title alphabetical), with a sort dropdown per column and a global default sort setting. Persist sort preference per board.
- [ ] **F54**: Planner Project Management — enable the planner to create new projects via a user-confirmed modal (name, location, git init, board selection), so tasks for new codebases get proper project directories from the start. Future phases: planner tags projects in tasks, uses cross-references, uses task dependencies. (Design: `docs/plans/2026-03-23-planner-project-management-design.md`)
- [ ] **F55**: Markdown Preview in Diff Viewer — add a toggle button on `.md` files in the diff viewer to switch between raw diff view and rendered markdown preview, so users can see how documentation and plan files will look when formatted
- [ ] **F56**: Task Play Button — add a play/start button directly on task cards in the kanban board, allowing users to kick off the next pipeline phase with one click instead of navigating into the task detail view
- [ ] **F57**: Quick Tasks — a lightweight task type that runs only a single phase (e.g., just planning, or just implementation) instead of the full pipeline. Useful for small, focused work like "fix this bug" or "write this doc" where the full plan→implement→review cycle is overkill. Configurable per task at creation time.
- [ ] **F58**: Cleanup Done Tasks — automatically or manually clean up task data (worktrees, agent files, context history) for tasks in DONE. Reclaim disk space from accumulated worktrees and logs. Options: auto-cleanup after N days, bulk cleanup button, per-task cleanup, keep only the final diff/plan.
- [ ] **F59**: Debug Mode Environment Variable — add a `DEVCONTROL_DEBUG` env var (or app setting) that controls visibility of debug features across the app. When enabled: show the planner debug panel, agent stream events, context history raw JSON, MCP tool call logs, and verbose error details. When disabled: hide all debug UI for a cleaner end-user experience. Default off in production builds, on in dev.

## Backlog (needs investigation)

- [ ] **F16**: Agent History Context — ensure each agent receives full task history so it doesn't redo completed work. Currently agents only see task directory files; they have no awareness of what phases ran, what previous agents did, or whether phases succeeded/failed.

## Design Documents

- Amendments design: `docs/plans/2026-03-10-task-amendments-design.md`

## Bugs & Fixes

- [ ] **B1**: Stop button not working properly — clicking Stop doesn't reliably kill the running agent process
- [ ] **B2**: Silent phase errors — when a phase fails to start (e.g., spawn error, invalid args), there is no UI indication; the task just stops with no error message shown to the user
- [ ] **B3**: Git section shows unrelated commits — the branch info in task details shows commits that don't belong to the task's branch (likely showing all commits instead of only those since branching from base)
- [ ] **B4**: Lint errors across codebase — ~60+ ESLint errors (unused imports, `any` types, missing hook deps) need a full sweep to fix. Run `npm run lint` to see all issues.
- [ ] **B5**: Workflows broken — workflow execution is not functioning after the F35 restructure. The workflow view, step execution, and progress tracking need to be restored and verified end-to-end.
- [ ] **B6**: Multi-project worktree creation fails silently — when a task has 2+ projects, only the first project gets a worktree. The second project's `createWorktree` call likely throws (e.g., `ensureBaseBranchUpToDate` or `resolveBaseBranch` failure) but the error is caught and only emitted as a terminal warning. The agent proceeds with only one worktree, missing the second project entirely. Need better error surfacing and possibly a retry mechanism. — the Window interface in `types/ipc.d.ts` and the actual `preload.cts` implementation are not validated against each other. Methods declared in the Window interface may not exist at runtime. Need to restructure so TypeScript catches mismatches at compile time (e.g., shared interface that preload implements).

## Notes

- Design doc: `docs/plans/2026-03-06-ai-automation-kanban-design.md`
- Implementation plan: `docs/plans/2026-03-06-ai-automation-kanban-implementation.md`
- Pipeline design: `docs/plans/2026-03-07-customizable-pipeline-design.md`
- Knowledge docs design: `docs/plans/2026-03-07-auto-generate-knowledge-docs-design.md`
- Agent security design: `docs/plans/2026-03-09-agent-security-design.md`
