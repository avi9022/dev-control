# General Conventions

## TypeScript

- **No `any` or `unknown`** — every variable, parameter, and return type must have a specific, meaningful type. Define interfaces or type aliases for all data shapes. When receiving untyped data from external sources (JSON parse, YAML load, external APIs), define an interface for the expected shape and validate/cast at the boundary.
- **No implicit typing** — always provide explicit type annotations for function parameters, return types, and variable declarations where the type isn't obvious from the assignment. Don't rely on TypeScript inference for public API surfaces (exported functions, component props, context values).
- **No casting** — never use `as` type assertions. If TypeScript can't infer the type, the code structure is wrong. Use type guards (`instanceof`, `in`, `typeof`), discriminated unions, or generics to narrow types safely. The only exception is when interfacing with a third-party library that has incorrect or incomplete type definitions — and even then, prefer wrapping with a properly typed function.
- **No suppression comments** — never use `eslint-disable`, `@ts-ignore`, or `@ts-expect-error`. Fix the root cause. If a rule is wrong for a pattern, change the ESLint config.
- **Unused variables** — remove them. Don't prefix with `_` to suppress. For catch blocks that don't use the error, use `catch {` (no parameter). For destructuring where you need to exclude a key, use `Object.fromEntries(Object.entries(...).filter(...))` instead of `{ [key]: _, ...rest }`.
- **No magic numbers** — extract numeric literals into named constants. Numbers like `0`, `1`, `-1` in obvious contexts (array index, increment) are fine. But `500`, `5000`, `200`, `3` scattered in code must be named constants that explain their purpose (e.g., `const POLL_INTERVAL_MS = 500`, `const MAX_RETRY_COUNT = 3`, `const DESCRIPTION_TRUNCATE_LENGTH = 200`).
- **No magic strings** — extract string literals used for comparisons, keys, or identifiers into named constants or enums. Strings in JSX content (labels, placeholders) are fine. But `if (status === 'running')` or `type: 'worktree'` should use an enum or constant.
- **Use enums for predefined value sets** — when a value can be one of a fixed set of options (statuses, types, modes, strategies), define it as a TypeScript enum or const object. Examples: task phases, git strategies, notification types, broker types. Union types (`'a' | 'b' | 'c'`) are acceptable for simple cases with 2-3 values, but prefer enums when the set is used across multiple files or has more than 3 values.
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
- **No comments** — good code is self-documenting. Use clear naming, small functions, and obvious structure instead of comments. If you need a comment to explain what code does, the code is too complex — refactor it. The only acceptable comments are: (1) TODO markers for known incomplete work, (2) legal/license headers if required, (3) JSDoc on exported public APIs that are consumed by other packages. Inline comments like `// check if user exists`, `// loop through items`, or `// set the value` are never acceptable.
- **Prefer `const`** — use `let` only when reassignment is needed. Never use `var`.

## Documentation

## Verification

- **Always run BOTH checks** after making changes:
  1. `npx tsc --noEmit` — catches type errors in the UI/shared code
  2. `npm run transpile:electron` — catches type errors in Electron code (stricter config)
- Never trust one without the other. They use different tsconfigs with different strictness levels.
- For full confidence, run `npm run build` which checks everything including the production bundle.

## Documentation

- **Roadmaps** go in `docs/roadmaps/`. Each major feature area gets its own roadmap file (e.g., `PLANNER_ROADMAP.md`, `AI_KANBAN_ROADMAP.md`). New features should be added to the relevant roadmap.
- **Design docs** go in `docs/plans/` with naming pattern `YYYY-MM-DD-<topic>-design.md`.
- **Implementation plans** go in `docs/plans/` with naming pattern `YYYY-MM-DD-<topic>-implementation.md`.
