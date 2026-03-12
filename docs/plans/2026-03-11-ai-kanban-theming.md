# AI Kanban Theming — Progress Tracker

> Migrate all AI automation components from hardcoded Tailwind dark-mode classes to CSS variable theme system (`var(--ai-*)`), supporting both dark and light modes.

## Theme Variables Reference

```
--ai-surface-0    Page background
--ai-surface-1    Column / panel background
--ai-surface-2    Card / elevated surface
--ai-surface-3    Badge background / subtle highlight
--ai-border       Strong border
--ai-border-subtle Subtle border
--ai-text-primary  Headings, titles
--ai-text-secondary Body text, descriptions
--ai-text-tertiary Muted text, placeholders
--ai-accent       Primary action color (sage green)
--ai-accent-subtle Accent tinted background
--ai-success / --ai-success-subtle
--ai-warning / --ai-warning-subtle
--ai-pink / --ai-pink-subtle
--ai-purple / --ai-purple-subtle
--ai-mono         Monospace font family
```

---

## Phases

### Phase 1: AITaskDetail.tsx ✅
- [x] Replace hardcoded neutral/slate/gray classes with CSS variables
- [x] Verify header, tabs, action buttons render correctly in both themes

### Phase 2: NewTaskDialog.tsx ✅
- [x] Replace hardcoded classes
- [x] Ensure dialog content, form inputs, project chips are themed
- [x] Add theme class to Dialog portal (renders outside .ai-kanban wrapper)

### Phase 3: DiffViewer.tsx ✅
- [x] Replace 30+ hardcoded color instances
- [x] Kept semantic diff colors (green/red for additions/deletions)
- [x] Verify comment overlays, resolved state, truncation UI

### Phase 4: MentionEditor.tsx ✅
- [x] Replace hardcoded classes in dropdown, input, chips

### Phase 5: AgentTerminal.tsx ✅
- [x] Replace hardcoded border/background classes

### Phase 6: TaskDevControl.tsx ✅
- [x] Replace hardcoded text/border/shadow classes

### Phase 7: AmendmentForm.tsx ✅
- [x] Replace hardcoded text color classes

### Phase 8: AISettings.tsx ✅
- [x] Replace any remaining hardcoded classes in settings panels
- [x] Ensure settings dialog looks correct in both themes

---

## Completed
- [x] AIKanban.tsx — Board, columns, header
- [x] TaskCard.tsx — Card, badges
- [x] mention-utils.tsx — Mention chips
- [x] index.css — Theme variables (dark + light palettes)
- [x] Theme toggle button in kanban header
