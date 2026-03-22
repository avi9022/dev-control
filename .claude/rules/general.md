# General Conventions

## TypeScript

- **No `any`** — use `unknown`, `Record<string, unknown>`, or proper interfaces. When receiving untyped data (JSON parse, YAML load, external APIs), type it at the boundary.
- **No suppression comments** — never use `eslint-disable`, `@ts-ignore`, or `@ts-expect-error`. Fix the root cause. If a rule is wrong for a pattern, change the ESLint config.
- **Unused variables** — remove them. Don't prefix with `_` to suppress. For catch blocks that don't use the error, use `catch {` (no parameter). For destructuring where you need to exclude a key, use `Object.fromEntries(Object.entries(...).filter(...))` instead of `{ [key]: _, ...rest }`.
- **Module resolution** — Electron code uses `NodeNext`. All internal imports in `src/electron/` must use `.js` extension (`import { foo } from './bar.js'`). UI code uses `@/*` alias mapping to `./src/*`.
- **All IPC types** live in `types.d.ts` under `EventPayloadMapping`. Never define IPC types elsewhere.

## File Organization

- **Small files** — 200-400 lines typical, 800 max. If a file grows past 400 lines, look for extraction opportunities.
- **Feature-based** — code is organized by domain (`sql/`, `mongodb/`, `docker/`, `ai-automation/`), not by technical layer.
- **One concern per file** — a file should do one thing. Don't mix unrelated utilities. Managers orchestrate, utilities compute, components render.

## Naming

- **Files:** PascalCase for components (`TaskCard.tsx`), kebab-case for utilities and managers (`task-manager.ts`, `run-service.ts`)
- **Functions:** camelCase. Handlers use `handle` prefix (`handleRetry`). Callback props use `on` prefix (`onSelect`, `onOpenChange`).
- **Types/Interfaces:** PascalCase. Use descriptive suffixes: `Settings`, `Config`, `State`, `Props` (`DirectorySettings`, `SQLConnectionConfig`, `ServiceRowProps`).
- **Constants:** UPPER_SNAKE_CASE for true constants (`TERRAIN_SIZE`, `DEFAULT_PIPELINE`). camelCase for configuration objects.

## Error Handling

- **Non-blocking async** — never let an unhandled promise crash the process. Use `.catch()` for fire-and-forget operations.
- **Graceful degradation** — if a feature fails to load (Docker not installed, DB not connected), show a meaningful state instead of crashing.
- **Process termination** — always SIGTERM first, then SIGKILL fallback. Use `tree-kill` to kill process trees.
- **Error messages** — extract message from Error objects: `err instanceof Error ? err.message : 'Default message'`

## Code Style

- **No over-engineering** — don't add abstractions for one-time operations. Three similar lines of code is better than a premature abstraction.
- **No dead code** — remove unused imports, variables, and functions. Don't comment them out.
- **Prefer `const`** — use `let` only when reassignment is needed. Never use `var`.
