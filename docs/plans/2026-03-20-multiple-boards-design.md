# F33: Multiple Boards — Design

## Goal

Allow users to create and switch between separate kanban boards, each with its own tasks and pipeline, while sharing global settings.

## Data Model

### New type
```typescript
interface AIBoard {
  id: string
  name: string
  color: string
  pipeline: AIPipelinePhase[]
  createdAt: string
}
```

### AITask changes
- Add `boardId: string`

### AIAutomationSettings changes
- Remove `pipeline` (moves to board)
- Add `boards: AIBoard[]`
- Add `activeBoardId: string`

Shared (global): maxConcurrency, defaultGitStrategy, defaultBaseBranch, stallTimeoutMinutes, knowledgeDocs, globalRules, notification toggles, theme, diff preferences.

## Migration

On startup, if `boards` doesn't exist:
1. Create default board: `{ id: 'default', name: 'My Board', color: '#9BB89E', pipeline: existingPipeline }`
2. Add `boardId: 'default'` to all existing tasks
3. Set `activeBoardId: 'default'`
4. Remove `pipeline` from settings

## UI

### Board Switcher (header dropdown)
- Shows current board name with colored dot
- Dropdown lists all boards, click to switch
- "New Board" button with inline name + color form
- Edit/delete per board (delete confirms, offers move tasks or delete)

### Kanban
- Filters tasks by `activeBoardId`
- Task creation assigns active board ID

### Settings
- Pipeline tab shows active board's pipeline
- All other tabs remain global

## Files Changed

| File | Change |
|------|--------|
| `types.d.ts` | AIBoard, boardId on AITask, boards/activeBoardId on settings |
| `src/electron/storage/store.ts` | Default board, migration |
| `src/electron/ai-automation/task-manager.ts` | Migration, board-aware task creation |
| `src/ui/views/AIKanban.tsx` | Board dropdown, filter by board |
| `src/ui/views/AISettings.tsx` | Pipeline from active board |
| `src/ui/components/ai-automation/BoardSwitcher.tsx` | New — dropdown component |
| `src/electron/ai-automation/agent-runner.ts` | Read pipeline from board |
| `src/electron/ai-automation/prompt-builder.ts` | Read pipeline from board |
