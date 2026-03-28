# Codebase Audit Report — Phase 3

**Date:** 2026-03-23
**Reviewers:** 10 parallel review agents covering the full codebase

## Summary

| Severity | Count |
|----------|-------|
| Critical | 15 |
| Important | ~85 |
| Minor | ~200 |

---

## Critical Issues

### Bugs

1. **`poll-updates.ts:9`** — Debug 1-second polling interval left in code (should be 10 minutes)
2. **`poll-updates.ts:26`** — Store key mismatch: writes `updateNotification` but all other code reads `updateNotificationSettings`
3. **`run-service.ts:95`** — Hardcoded "port 3000" in log messages while actual port is dynamic
4. **`request-executor.ts:226`** — Digest auth hardcodes `GET` method, produces wrong hashes for non-GET requests
5. **`request-executor.ts:249`** — Hawk auth hardcodes `GET`/`localhost`/`80`, wrong for any real request
6. **`Queue.tsx:113,141`** — Missing React `key` props in `.map()` renders
7. **`Queue.tsx:28`** — `JSON.parse(storedMessage)` without try-catch, crashes on corrupted localStorage

### File Size (>800 lines max)

8. **`docker-manager.ts`** — 1592 lines (2x max)
9. **`DiffViewer.tsx`** — 1187 lines (1.5x max)
10. **`ApiClientMenu.tsx`** — 1143 lines (1.4x max)
11. **`main.ts`** — 1226 lines (1.5x max)
12. **`types.d.ts`** — 2623 lines (3x max)

### Hardcoded Colors (systemic)

13. **SQL components** (~15 files) — entire dark theme built with hardcoded hex (`#1a1b1e`, `#1e1f23`, `#c74634`)
14. **`ContainerDetail.tsx`** — two duplicated xterm themes with ~15 hardcoded colors each
15. **`XtermTerminal.tsx`** — full ANSI palette hardcoded instead of CSS variables

### Security

16. **`schema-inspector.ts:296`** — SQL injection risk: `getTableRowCount` interpolates schema/table names directly into SQL

---

## Systemic Issues (Important, cross-cutting)

### No-casting violations (~50+ instances)

The `as` keyword is used pervasively:
- **MCP tools** (9 instances) — root cause: `McpToolDefinition.handler` accepts `Record<string, unknown>`. Fix: make generic.
- **Select components** (~10 instances) — `v as SomeType` from Select values. Fix: typed Select wrapper.
- **JSON.parse** (~15 instances) — unvalidated parse results cast to typed interfaces. Fix: define boundary types with validation.
- **Error handling** (~8 instances) — `(err as Error).message`. Fix: use `err instanceof Error ? err.message : String(err)`.
- **Double casts** (3 instances) — `as unknown as SomeType` in VariableInput.tsx, PipelineDiagram.tsx, AggregationBuilder.tsx.

### Magic strings (systemic)

- **Phase IDs**: `'BACKLOG'`, `'DONE'` used across ~15 files — need constants
- **Phase types**: `'agent'`, `'manual'`, `'fixed'` — need enum
- **Exit events**: `'crashed'`, `'stopped'`, `'stalled'`, `'error'`, `'completed'` — need enum
- **Git strategies**: `'worktree'`, `'none'` — need enum
- **Resolver types**: `'human'`, `'agent'` — need enum
- **Directory states**: `'RUNNING'`, `'STOPPED'`, `'UNKNOWN'`, `'INITIALIZING'` — need enum
- **Workflow statuses**: `'starting'`, `'stopping'`, `'running'`, `'idle'`, `'error'` — need enum
- **Default colors**: `'#7C8894'`, `'#9BB89E'` duplicated across 4+ files

### Magic numbers (systemic)

- **Timeouts**: 500, 1000, 3000, 5000, 7000, 10000, 30000, 60000, 120000 scattered without named constants
- **Limits**: 50 (notifications), 200 (diff threshold), 5000 (truncation), 10000 (max rows)
- **Sizes**: `task.id.slice(0, 8)` — the `8` for short ID appears in ~10 files

### Duplicated code

- **`getClaudePath()`** — identical in `agent-runner.ts` and `knowledge-generator.ts`
- **`formatBytes()`** — duplicated 4 times across docker/mongodb components
- **`formatDate()`** — duplicated 3 times in docker components
- **`findItemPath()`** — duplicated in `variable-resolver.ts` and `api-client-manager.ts`
- **`resolveInheritedAuth()`** — duplicated in same two files
- **`archiveMessage()`** — duplicated in both broker clients
- **Xterm themes** — duplicated in ContainerDetail.tsx (2x) and XtermTerminal.tsx

### Suppression comments (pre-existing)

- `get-service-queues.ts:1` — file-wide eslint-disable
- `JsonInput.tsx:1` — file-wide eslint-disable
- `SQLEditor.tsx:288` — exhaustive-deps disable
- `Queue.tsx:42` — no-explicit-any disable
- `sql.tsx:573` — unused-vars disable
- `workflows.tsx:75` — unused-vars disable
- `mcp-server.ts:30` — @ts-expect-error
- `request-executor.ts:89` — @ts-expect-error
- `SplitScreenChoice.tsx:21` — @ts-expect-error

### Dead code

- **`ZoneBuilding.tsx`** — entire file unused, superseded by buildings/ directory
- **`sqs.ts`**, `get-queue-attributes.ts`, `get-waiting-messages.ts` — legacy, superseded by broker abstraction
- **`poll-updates.ts`** — commented-out import in main.ts, function never called
- **MongoDB stubs** in main.ts (4 handlers that return null/no-op)
- **`themeClass = ''`** — dead variable in NewTaskDialog.tsx and TaskFilesTab.tsx
- **`Service.tsx:42`** — `console.log` left in onChange handler
- **`processedPaths`** in schema-analyzer.ts — written but never read
- **`_eventType`**, **`_name`** — underscore-prefixed unused vars (Phase 1 artifacts)

### Missing explicit types

- ~20 exported functions in `src/electron/functions/` have no return type annotations
- `getSettings()` in notification-manager has no return type
- Multiple context value interfaces are inline instead of named

### File size violations (400-800 range, need extraction)

- `agent-runner.ts` (849), `MongoDBMenu.tsx` (875), `sql.tsx` (842)
- `ContainerDetail.tsx` (784), `FilesTab.tsx` (756), `AITaskDetail.tsx` (727)
- `NewTaskDialog.tsx` (659), `DocumentList.tsx` (654)
- `JsonEditor.tsx` (555), `VariablesPanel.tsx` (554), `PipelineDiagram.tsx` (540)
- `CodeSnippetPanel.tsx` (535), `RequestAuthEditor.tsx` (531), `SQLMenu.tsx` (518)
- `TaskCube.tsx` (505), `AISettings.tsx` (504), `MentionEditor.tsx` (493)
- `DynamoDB.tsx` (495), `RequestPanel.tsx` (493), `textures.ts` (481)
- `QueryBuilder.tsx` (465), `ResultsGrid.tsx` (429), `TableColumnsTab.tsx` (560)

### Other notable findings

- **`AITaskPhase = 'BACKLOG' | 'DONE' | string`** collapses to `string` — no type safety
- **SQL Manager** creates its own `new Store()` instead of using the shared typed store
- **DynamoDB files** have no try/catch — errors propagate with no context
- **Planner runner** doesn't track child process in a Map, no cleanup on app quit
- **`--allowedTools` string** in planner-runner.ts must be manually kept in sync with MCP tool registry
- **`any` in preload.cts:406** — the IPC bridge callback parameter
- **`NewTaskDialog.tsx`** has its own inline contentEditable implementation duplicating MentionEditor logic
- **PlannerChat** saves to disk on every debug event without debouncing
- **`MainContent.tsx:144`** — dynamic Tailwind class `basis-1/${views.length}` won't work (purged at build)

---

## Fix Priority for Phase 4

### Step 1: Shared infrastructure (sequential)

1. Create enums/constants file for all magic strings
2. Create shared utilities (formatBytes, formatDate, getClaudePath)
3. Fix types.d.ts (AITaskPhase, add missing store fields)
4. Fix store.ts (add sqlHistory, sqlSavedQueries to schema)
5. Fix bugs (poll-updates interval + store key, run-service port log, Queue.tsx keys + JSON.parse)
6. Remove dead code (ZoneBuilding, sqs legacy, stubs, console.log, themeClass)
7. Fix suppression comments
8. Fix preload.cts `any`

### Step 2: Fix areas in parallel

- **AI kanban backend** — replace casts with type guards, extract constants, split agent-runner
- **AI kanban frontend** — split DiffViewer/NewTaskDialog, replace casts, fix hook deps
- **DevControl backend** — split docker-manager, fix SQL injection, add DynamoDB try/catch, fix auth bugs
- **DevControl frontend** — replace hardcoded hex with CSS vars, split large files, fix duplicated utils, typed Select wrapper
