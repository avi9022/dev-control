# F35: Kanban as Main View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the kanban board the primary landing page with a slim icon sidebar for switching between Kanban and DevControl views.

**Architecture:** Replace the floating Bot toggle with a permanent 48px icon navbar on the left edge. Both views stay mounted (hidden via CSS) to preserve state. Kanban is the default view.

**Tech Stack:** React, Tailwind, Lucide icons

---

### Task 1: Create AppNavbar component

**Files:**
- Create: `src/ui/components/AppNavbar.tsx`

A slim 48px-wide nav bar with:
- Background: `var(--ai-surface-0)`
- Icons stacked at top with 4px gap
- Two icons: LayoutGrid (Kanban), Wrench (DevControl)
- Active icon: `var(--ai-accent)` color + 3px rounded bar on left edge
- Inactive: `var(--ai-text-tertiary)`, hover → `var(--ai-text-secondary)`
- Tooltip on hover
- Icons are ~18px (`size-[18px]`)
- Each icon button is 36px tall, centered

### Task 2: Restructure App.tsx

**Files:**
- Modify: `src/ui/App.tsx`

Changes:
- Remove `aiMode` state, replace with `activeView: 'kanban' | 'devcontrol'` defaulting to `'kanban'`
- Remove the floating Bot button entirely
- Root layout becomes: `flex` row → `<AppNavbar />` + view container
- Both views render always, hidden via `display: none` style on inactive view
- Keep all existing providers exactly as they are
- The theme effect stays in App.tsx

### Task 3: Cleanup

- Remove Bot import from App.tsx
- Verify both views work, switching preserves state
- Verify theme toggle in kanban affects DevControl too
