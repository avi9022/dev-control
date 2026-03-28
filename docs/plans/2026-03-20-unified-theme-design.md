# F34: Unified Theme Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the dual-theme system (cool shadcn defaults for DevControl + warm charcoal `.ai-kanban` scope for AI Kanban) with a single unified warm charcoal theme that applies to the entire app, with dark/light mode toggle.

**Architecture:** Promote the AI kanban's `--ai-*` CSS variables to be the global root theme. Map shadcn variables (`--background`, `--card`, `--primary`, etc.) to the warm charcoal values so all existing Tailwind classes automatically pick up the new palette. Remove `.ai-kanban` scoping entirely. Theme toggle in AI Kanban header applies `.light` class on `<html>` globally.

**Tech Stack:** CSS custom properties, Tailwind v4, shadcn/Radix UI

---

### Task 1: Rewrite `:root` and `.dark` blocks with warm charcoal dark values

**Files:**
- Modify: `src/ui/index.css:46-115`
- Modify: `index.html:2`

**Step 1: Replace `:root` with warm charcoal dark defaults**

In `src/ui/index.css`, replace the `:root` block (lines 46-80) AND the `.dark` block (lines 82-115) with a single `:root` block:

```css
:root {
  --radius: 0.625rem;
  --background: #1C1917;
  --foreground: #FAF9F7;
  --card: #2E2A28;
  --card-foreground: #FAF9F7;
  --popover: #2E2A28;
  --popover-foreground: #FAF9F7;
  --primary: #9BB89E;
  --primary-foreground: #1C1917;
  --secondary: #3A3533;
  --secondary-foreground: #FAF9F7;
  --muted: #3A3533;
  --muted-foreground: #7A756F;
  --accent: #3A3533;
  --accent-foreground: #FAF9F7;
  --destructive: #D46B6B;
  --success: #8BC5A0;
  --border: #4A4442;
  --input: #3A3533;
  --ring: #7A756F;
  --chart-1: #9BB89E;
  --chart-2: #D4A0A0;
  --chart-3: #E5C287;
  --chart-4: #B5A3D1;
  --chart-5: #6BBDD4;
  --sidebar: #252220;
  --sidebar-foreground: #FAF9F7;
  --sidebar-primary: #9BB89E;
  --sidebar-primary-foreground: #1C1917;
  --sidebar-accent: #3A3533;
  --sidebar-accent-foreground: #FAF9F7;
  --sidebar-border: #4A4442;
  --sidebar-ring: #7A756F;
}
```

**Step 2: Remove the `.dark` block entirely** (lines 82-115)

**Step 3: Update `index.html`**

Change `<html lang="en" class="dark">` to just `<html lang="en">` — dark is now the default, no class needed.

**Step 4: Update the Tailwind dark variant**

Change line 5 from:
```css
@custom-variant dark (&:is(.dark *));
```
to:
```css
@custom-variant dark (&:is(:root:not(.light) *));
```

This makes `dark:` utilities active by default (when `.light` is NOT present).

**Step 5: Verify** — Run `npm run dev:react` and confirm the DevControl views now have warm charcoal backgrounds and sage green accents.

---

### Task 2: Add `.light` class with warm light palette

**Files:**
- Modify: `src/ui/index.css` (after the `:root` block)

**Step 1: Add `.light` class block**

Add after the `:root` block:

```css
.light {
  --background: #F7F5F2;
  --foreground: #2C2825;
  --card: #FFFFFF;
  --card-foreground: #2C2825;
  --popover: #FFFFFF;
  --popover-foreground: #2C2825;
  --primary: #4A7A4E;
  --primary-foreground: #F7F5F2;
  --secondary: #F0EEEB;
  --secondary-foreground: #2C2825;
  --muted: #F0EEEB;
  --muted-foreground: #7A756F;
  --accent: #F0EEEB;
  --accent-foreground: #2C2825;
  --destructive: #B54444;
  --success: #4A7A4E;
  --border: #E0DCD7;
  --input: #E0DCD7;
  --ring: #D0CBC5;
  --chart-1: #4A7A4E;
  --chart-2: #A05858;
  --chart-3: #9A7A28;
  --chart-4: #7560A0;
  --chart-5: #3A8A9A;
  --sidebar: #FFFFFF;
  --sidebar-foreground: #2C2825;
  --sidebar-primary: #4A7A4E;
  --sidebar-primary-foreground: #F7F5F2;
  --sidebar-accent: #F0EEEB;
  --sidebar-accent-foreground: #2C2825;
  --sidebar-border: #E0DCD7;
  --sidebar-ring: #D0CBC5;
}
```

---

### Task 3: Move `--ai-*` variables to `:root` and `.light`

**Files:**
- Modify: `src/ui/index.css`

**Step 1: Move `--ai-*` dark variables into `:root`**

Take the variables from the `.ai-kanban` block (lines 149-184) and add them inside the `:root` block. Include font-family and mono too:

```css
/* Inside :root, after the shadcn vars: */
font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
--ai-surface-0: #1C1917;
--ai-surface-1: #252220;
--ai-surface-2: #2E2A28;
--ai-surface-3: #3A3533;
--ai-border: #4A4442;
--ai-border-subtle: #3A3533;
--ai-text-primary: #FAF9F7;
--ai-text-secondary: #B0AAA4;
--ai-text-tertiary: #7A756F;
--ai-accent: #9BB89E;
--ai-accent-subtle: #2D3530;
--ai-success: #8BC5A0;
--ai-success-subtle: #2A3530;
--ai-warning: #E5C287;
--ai-warning-subtle: #3A3328;
--ai-pink: #D4A0A0;
--ai-pink-subtle: #3A2E2E;
--ai-purple: #B5A3D1;
--ai-purple-subtle: #332D3E;
--ai-sage: #9BB89E;
--ai-sage-subtle: #2D3530;
--ai-mono: 'JetBrains Mono', monospace;
--ai-diff-added-bg: rgba(34, 197, 94, 0.12);
--ai-diff-removed-bg: rgba(239, 68, 68, 0.12);
--ai-diff-added-text: #4ade80;
--ai-diff-removed-text: #f87171;
--ai-diff-hunk-bg: var(--ai-accent-subtle);
--ai-diff-hunk-text: var(--ai-accent);
--ai-diff-line-num: var(--ai-text-tertiary);
--ai-diff-empty-bg: rgba(255, 255, 255, 0.03);
```

**Step 2: Move `--ai-*` light variables into `.light`**

Add the light overrides from `.ai-kanban.ai-light` (lines 186-217) into the `.light` block:

```css
/* Inside .light, after the shadcn vars: */
--ai-surface-0: #F7F5F2;
--ai-surface-1: #FFFFFF;
--ai-surface-2: #F0EEEB;
--ai-surface-3: #E5E2DD;
--ai-border: #D0CBC5;
--ai-border-subtle: #E0DCD7;
--ai-text-primary: #2C2825;
--ai-text-secondary: #5C5752;
--ai-text-tertiary: #7A756F;
--ai-accent: #4A7A4E;
--ai-accent-subtle: #DCEEDE;
--ai-success: #4A7A4E;
--ai-success-subtle: #DCEEDE;
--ai-warning: #9A7A28;
--ai-warning-subtle: #F0E4C5;
--ai-pink: #A05858;
--ai-pink-subtle: #F0DCDC;
--ai-purple: #7560A0;
--ai-purple-subtle: #E5DDF0;
--ai-sage: #4A7A4E;
--ai-sage-subtle: #DCEEDE;
--ai-diff-added-bg: rgba(34, 197, 94, 0.1);
--ai-diff-removed-bg: rgba(239, 68, 68, 0.08);
--ai-diff-added-text: #16a34a;
--ai-diff-removed-text: #dc2626;
--ai-diff-hunk-bg: var(--ai-accent-subtle);
--ai-diff-hunk-text: var(--ai-accent);
--ai-diff-line-num: #B0AAA4;
--ai-diff-empty-bg: #F4F2EF;
```

**Step 3: Remove the old `.ai-kanban` and `.ai-kanban.ai-light` blocks** (lines 149-217)

**Step 4: Update the portal light override block** (lines 219-244)

Replace:
```css
.ai-kanban.ai-light,
[data-ai-theme="light"] [data-radix-popper-content-wrapper],
[data-ai-theme="light"] [data-radix-portal] {
```
With:
```css
.light [data-radix-popper-content-wrapper],
.light [data-radix-portal] {
```
And update the values inside to reference the `.light` vars (or just remove this block since `.light` on `:root` should cascade to portals — test this).

---

### Task 4: Remove `.ai-kanban` scoping from component CSS classes

**Files:**
- Modify: `src/ui/index.css` (lines 246-328)

**Step 1: Remove `.ai-kanban` prefix from remaining utility classes**

Change:
- `.ai-kanban [contenteditable]:empty::before` → `[contenteditable]:empty::before` (or scope narrower if needed)
- `.ai-kanban .ai-card` → `.ai-card`
- `.ai-kanban .ai-card:hover` → `.ai-card:hover`
- `.ai-kanban .ai-column` → `.ai-column`
- `.ai-kanban .ai-dot` → `.ai-dot`
- `.ai-kanban .ai-badge` → `.ai-badge`

The `.ai-markdown` and `.pipeline-add-btn` classes are already unscoped — leave as-is.

---

### Task 5: Update theme toggle in AIKanban.tsx

**Files:**
- Modify: `src/ui/views/AIKanban.tsx:20-32`

**Step 1: Change theme class logic**

Replace:
```typescript
const themeClass = isLight ? 'ai-kanban ai-light' : 'ai-kanban'
```
with removal of `themeClass` entirely — the kanban wrapper div no longer needs a theme class.

**Step 2: Update the `<html>` class toggling**

Replace the `useEffect` (lines 24-32):
```typescript
useEffect(() => {
  if (isLight) {
    document.documentElement.classList.add('light')
  } else {
    document.documentElement.classList.remove('light')
  }
  return () => document.documentElement.classList.remove('light')
}, [isLight])
```

Remove the `data-ai-theme` attribute logic — no longer needed.

**Step 3: Remove `themeClass` from the root div**

The kanban root div should use a plain className without `.ai-kanban`.

---

### Task 6: Apply theme on app load (not just when kanban is visible)

**Files:**
- Modify: `src/ui/App.tsx`

**Step 1: Add theme sync effect in App component**

The theme toggle lives in AIKanban, but the `.light` class needs to be on `<html>` even when viewing DevControl. Add a useEffect in `App` that reads the AI settings theme and applies the class:

```typescript
// Inside App function, before return:
useEffect(() => {
  // Subscribe to AI settings for theme
  const unsubscribe = window.electron.subscribeAISettings?.((settings: AIAutomationSettings) => {
    if (settings?.theme === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
  })

  // Also set initial theme from stored settings
  window.electron.aiGetSettings?.().then((settings: AIAutomationSettings) => {
    if (settings?.theme === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
  })

  return () => unsubscribe?.()
}, [])
```

Note: Check if `subscribeAISettings` exists. If the settings are only available via the `useAIAutomation` hook, this can be done inside the `AIAutomationProvider` instead since it wraps everything.

---

### Task 7: Fix hardcoded colors in DevControl components

**Files:**
- Search and fix: `src/ui/components/AppSidebar/`, `src/ui/App.tsx`, any components using hardcoded color classes

**Step 1: Audit for hardcoded neutral colors**

Search for Tailwind classes like `bg-neutral-*`, `bg-stone-*`, `bg-slate-*`, `bg-gray-*`, `text-white`, `hover:bg-neutral-*` in DevControl components. These bypass the theme system.

Key known instances:
- `App.tsx:77`: `bg-transparent hover:bg-neutral-500 text-white` on sidebar toggle button
- `App.tsx:112`: `bg-neutral-800 hover:bg-neutral-700 text-white` on AI mode toggle button
- `AppSidebar` components: likely has `bg-stone-600` or similar

**Step 2: Replace with theme-aware classes**

Replace hardcoded colors with Tailwind theme classes:
- `bg-neutral-800` → `bg-card` or `bg-muted`
- `hover:bg-neutral-500` → `hover:bg-accent`
- `text-white` → `text-foreground`
- `bg-stone-600` → `bg-muted`

---

### Task 8: Update scrollbar styles

**Files:**
- Modify: `src/ui/index.css:126-138`

**Step 1: Scrollbar already uses `var(--border)`** which is now warm. Verify it looks good. If the thumb is too subtle in light mode, adjust.

---

### Task 9: Verify and fix Radix portal theming

**Files:**
- Modify: `src/ui/index.css` (portal override block)

**Step 1: Test that Radix dialogs, selects, and popovers** pick up the correct theme in both dark and light mode. The `.light` class on `<html>` should cascade into portals since they're children of `<body>` which is a child of `<html>`.

**Step 2: If portals don't pick up `.light` styles**, add explicit targeting:
```css
.light [data-radix-popper-content-wrapper],
.light [data-radix-portal] {
  color: var(--foreground);
}
```

Otherwise remove the portal override block entirely.

---

### Task 10: Final cleanup and verification

**Step 1:** Search for any remaining references to `.ai-kanban` class in TypeScript/TSX files and remove them.

**Step 2:** Search for `data-ai-theme` references and remove them.

**Step 3:** Verify both modes work:
- Dark mode (default): warm charcoal everywhere — kanban, sidebar, services, Docker, SQL, API client
- Light mode (toggle): warm light palette everywhere
- Radix dialogs/popovers match the current theme
- Scrollbars match
- The AI mode toggle button (Bot icon) is visible in both themes

**Step 4:** Run `npm run lint` to catch any issues.

**Step 5:** Commit all changes.
