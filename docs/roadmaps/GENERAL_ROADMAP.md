# DevControl General — Roadmap

General system-wide bugs and features that don't belong to a specific feature area.

## Bugs

- [ ] **GB1**: JSON Diff tool broken — the JSON Diff developer tool is not functioning correctly, needs investigation and fix
- [ ] **GB2**: Duplicated services in task DevControl view — the TaskDevControl panel shows duplicate entries for services, likely caused by worktree directories being included alongside the original project directories
- [ ] **GB3**: Failed worktree creation should return task to backlog — when a task fails to create a worktree (e.g., git error, branch conflict, disk issue), the task currently stays in its phase with a warning in the terminal. It should be moved back to BACKLOG with a clear error message so the user can fix the issue and retry.
- [ ] **GB4**: Preload/Window type mismatch — the Window interface in types/ipc.d.ts and the actual preload.cts implementation are not validated against each other. Methods declared in the Window interface may not exist at runtime. Need to restructure so TypeScript catches mismatches at compile time.

## Planned Features

- [ ] **GF1**: Auto-Generate Project Knowledge on Registration — when a new project is added to DevControl (via folder scan, planner project creation, or manual add), automatically trigger knowledge generation in the background. The user sees a "Generating..." status on the project and the profile/knowledge docs are ready by the time they need them.
- [x] **GF2**: MCP Progress Notifications — progress keep-alive every 15s for long-running tools (project creation, task stepper) prevents Claude CLI's 60s timeout

## Backlog
