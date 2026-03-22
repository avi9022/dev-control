# UI Conventions (React / Renderer Process)

## Component Structure

- **Functional components only** — use `FC<Props>` or plain function components with typed props.
- **Props interface** — define above the component, named `ComponentNameProps`. Callback props use `on` prefix.
- **One component per file** — exception: small helper components tightly coupled to the main component can live in the same file.

```typescript
interface TaskCardProps {
  task: AITask
  onSelect: (id: string) => void
  isActive?: boolean
}

export const TaskCard: FC<TaskCardProps> = ({ task, onSelect, isActive }) => {
  // ...
}
```

## State Management

- **Context API** — one context per feature area. Never prop-drill more than 2 levels.
- **Context pattern** — every context file follows this structure:
  1. Create typed context with `createContext`
  2. Export `useX()` hook that calls `useContext`
  3. Export `XProvider` component that wraps children
  4. Set up IPC subscriptions in `useEffect` with cleanup (`return () => unsubscribe()`)
- **Local state** — use `useState` for UI-only state (modals, inputs, selections). Use context for shared state.
- **Immutable updates** — always spread or create new objects/arrays. Never mutate state directly.

## Hooks

- **`useEffect` dependencies** — always include all dependencies. If adding a dependency causes infinite loops:
  - Wrap functions in `useCallback`
  - Use `useRef` for stable references to values that change but shouldn't trigger re-runs
  - Move constants to module scope
- **Never use empty deps `[]` to run once** — if an effect truly runs once, structure it so dependencies are stable (refs, module-level values). Don't suppress the exhaustive-deps rule.
- **`useCallback`** — use for functions passed as props to child components or used in dependency arrays. Don't wrap every function — only when it prevents unnecessary re-renders.

## Styling

- **Tailwind + CSS variables** — use Tailwind utility classes for layout and spacing. Use CSS custom properties for colors and theming.
- **Theme variables** — always use `var(--ai-*)` variables for colors, never hardcoded hex values in component styles:
  - `--ai-surface-0` through `--ai-surface-3` for backgrounds
  - `--ai-text-primary`, `--ai-text-secondary`, `--ai-text-tertiary` for text
  - `--ai-border`, `--ai-border-subtle` for borders
  - `--ai-accent`, `--ai-accent-subtle` for interactive elements
- **Inline styles** — use `style={{ }}` for dynamic CSS variable values. Use `className` for static Tailwind classes.

## Component Library

- **Radix UI + shadcn** — use primitives from `src/components/ui/` (Button, Input, Dialog, Select, Tooltip, etc.)
- **Don't reinvent** — if shadcn has a component, use it. Don't build custom dropdowns, dialogs, or tooltips.
- **Dialog pattern** — always use `DialogContent > DialogHeader > DialogTitle` + `DialogFooter` with Cancel/Confirm buttons.

## IPC Communication

- **Request-response:** `await window.electron.methodName(args)` — for fetching data or triggering actions.
- **Subscriptions:** Set up in `useEffect`, always return unsubscribe function:

```typescript
useEffect(() => {
  const unsub = window.electron.subscribeEvent((data) => setState(data))
  return () => unsub?.()
}, [])
```

## Content-Editable Editors (MentionEditor pattern)

- **Chip system** — non-editable `<span>` elements with `data-mention-id` (projects) or `data-task-id` (tasks) attributes.
- **Plain text extraction** — `getPlainText()` walks DOM, converts chips to `@label` or `#shortId` format.
- **Hydration** — `hydrateText()` reconstructs chips from plain text for edit mode.
- **Trigger characters** — `@` for project tagging, `#` for task cross-references.
