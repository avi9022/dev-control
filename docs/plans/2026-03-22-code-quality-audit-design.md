# F43/F44: Code Quality & Codebase Audit — Design

## Goal

Bring the entire codebase to a clean, consistent standard with enforced conventions. Zero lint errors, documented rules, and every file reviewed and fixed.

## Definition of Done

1. Clean lint, TypeScript compile, and build — zero errors, zero warnings
2. A set of agent rules (`.claude/rules/`) so things don't break or go out of conventions later
3. Full code review to detect where code has gone bad
4. Fix everything and make sure everything is up to standards

## Phase 1: Clean Baseline

Fix all existing lint issues (currently 140 problems: 70 errors, 70 warnings). No behavior changes — strictly mechanical fixes.

**Error breakdown:**
- ~20 `no-explicit-any` — replace with proper types
- ~15 `no-unused-vars` — remove dead imports/variables
- ~6 `no-useless-escape` — remove unnecessary regex escapes
- ~3 ESLint config issues (missing rule definitions)
- Misc: case declarations, etc.

**Warning breakdown:**
- ~38 `react-refresh/only-export-components` — move non-components to separate files or suppress where intentional (contexts)
- ~10 `react-hooks/exhaustive-deps` — fix missing hook dependencies

**Verification:** `npm run lint` returns 0, `npx tsc --noEmit` passes, `npm run build` succeeds.

## Phase 2: Establish Rules

Create `.claude/` project config structure:

```
.claude/
  CLAUDE.md              # Migrated from root CLAUDE.md
  rules/
    general.md           # TypeScript, file organization, naming, error handling, imports
    ui.md                # React patterns, components, Radix/Tailwind/theme vars, context, state
    electron.md          # Main process, IPC, child processes, security, preload
```

**Approach:** Rules are derived from existing codebase patterns — codify what's already working well, flag what should change. Not invented from scratch.

### Rule file topics

**general.md:**
- TypeScript: strict types, no `any`, NodeNext module resolution, `.js` imports in electron code
- File organization: small files (200-400 lines, 800 max), organized by feature/domain
- Naming: conventions for files, functions, types, interfaces
- Error handling: non-blocking async, graceful degradation, SIGTERM then SIGKILL
- Imports: `@/*` alias for `./src/*`, all IPC types in `types.d.ts`
- Code style: no over-engineering, YAGNI, DRY

**ui.md:**
- React: Context API over prop drilling, functional components with hooks, immutable state updates
- Components: Radix UI primitives, shadcn components in `components/ui/`
- Styling: Tailwind + CSS custom properties for theme (`--ai-*` vars), no inline colors
- State: one context per feature area, `useEffect` subscriptions to IPC, proper cleanup
- Patterns: contentEditable editors, mention/chip system, modal/dialog patterns

**electron.md:**
- IPC: typed via `EventPayloadMapping`, validate with `validateEventFrame()`, use `ipcMainHandle()`
- Security: never expose filesystem to renderer, validate all inputs from renderer
- Child processes: `tree-kill` for termination, sanitize spawn arguments (no null bytes)
- Storage: `electron-store` schema in `store.ts`, getters pattern
- MCP server: HTTP transport, dynamic port, session-per-connection

## Phase 3: Full Code Review

5 parallel review agents, each covering one area and reviewing against Phase 2 rules.

### Review areas

1. **AI kanban backend** — `src/electron/ai-automation/` (task-manager, agent-runner, prompt-builder, worktree-manager, mcp-server, mcp-tools/, notification-manager, knowledge-generator, cross-reference-parser, planner-runner)
2. **AI kanban frontend** — `src/ui/components/ai-automation/`, `src/ui/views/AI*.tsx`, `src/ui/contexts/ai-automation.tsx`
3. **DevControl backend** — `src/electron/functions/`, `sql/`, `mongodb/`, `dynamodb/`, `docker/`, `brokers/`, `api-client/`, `sqs/`
4. **DevControl frontend** — `src/ui/views/` (non-AI), `src/ui/components/` (non-AI), `src/ui/contexts/` (non-AI), `src/ui/hooks/`
5. **Shared infrastructure** — `types.d.ts`, `src/electron/preload.cts`, `src/electron/main.ts`, `src/electron/storage/`, `src/electron/utils/`, `src/ui/App.tsx`, `src/components/ui/`

### Review checklist per area

- Type safety: any remaining `any` types, unsafe casts, missing return types
- Dead code: unused functions, unreachable branches, commented-out code
- Error handling: unhandled promises, missing try/catch, silent failures
- Naming: inconsistent naming, unclear function names
- File size: files over 400 lines that should be split
- Duplication: repeated patterns that should be extracted
- Performance: unnecessary re-renders, missing memoization, expensive computations in render
- Security: unsanitized inputs, exposed internals
- Consistency: patterns that deviate from established conventions

### Output

Single consolidated report: `docs/plans/2026-03-22-codebase-audit-report.md`

Organized by area, each issue tagged with severity:
- **Critical** — bugs, security issues, data loss risks
- **Important** — violations of established patterns, maintainability concerns
- **Minor** — style inconsistencies, naming nitpicks

## Phase 4: Fix Everything

### Execution order

**Step 1 (sequential):** Fix shared infrastructure first
- `types.d.ts`, `main.ts`, `preload.cts`, `storage/`, `utils/`, `App.tsx`
- These are dependencies for everything else — must be stable before parallel work
- Verify lint + build after completion

**Step 2 (parallel):** Fix remaining 4 areas simultaneously
- AI kanban backend
- AI kanban frontend
- DevControl backend
- DevControl frontend
- Each area commits independently, no cross-area file edits
- Verify lint + build after each area completes

**Step 3:** Final verification
- Full `npm run lint` — must be 0 errors, 0 warnings
- Full `npx tsc --noEmit` — must pass
- Full `npm run build` — must succeed
- Manual smoke test: app launches, kanban board works, DevControl views load
