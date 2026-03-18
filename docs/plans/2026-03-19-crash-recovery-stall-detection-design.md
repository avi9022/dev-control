# F6: Process Crash Recovery & Stall Detection — Design

## Goal

Detect and recover from two failure modes: app crashes while an agent is running, and agents that stall with no output. Provide clear UI indicators and user actions for both.

## Data Model

### New enum

```typescript
enum AITaskAttentionReason {
  Crashed = 'crashed',
  Stalled = 'stalled',
  MaxRetries = 'max_retries',
  Error = 'error',
}
```

### AITask changes

- `needsUserInput: boolean` — unchanged
- `needsUserInputReason?: AITaskAttentionReason` — new, set alongside needsUserInput
- `stallRetryCount?: number` — tracks stall retries for current phase

### AIPipelinePhase changes

- `stallTimeout?: number` — per-phase timeout override in minutes

### AIAutomationSettings changes

- `stallTimeoutMinutes: number` — global default, defaults to 3

## Crash Recovery

On app startup, `recoverStaleTasks()` runs:

1. Find tasks with `activeProcessPid` set
2. Check if PID is alive via `process.kill(pid, 0)`
3. If dead: clear `activeProcessPid`/`currentPhaseName`, set `needsUserInput: true` + `needsUserInputReason: Crashed`

Runs once before any agents spawn. Silent cleanup with flag for UI.

## Stall Detection

Per spawned agent:

1. Track `lastEventTime` — updated on every stream-json event (any type)
2. Check interval every 30 seconds: compare elapsed time against timeout
3. Timeout resolution: `phaseConfig.stallTimeout ?? settings.stallTimeoutMinutes`, converted to ms
4. On stall detected:
   - Kill process via tree-kill
   - If `stallRetryCount < 3`: increment count, emit warning to terminal, re-enqueue same phase
   - If `stallRetryCount >= 3`: set `needsUserInput: true` + `needsUserInputReason: MaxRetries`
5. Clear interval on process exit
6. Reset `stallRetryCount` to 0 on successful phase completion

## UI: Kanban Card Badge

When `task.needsUserInput` is true:

- Amber warning badge on the TaskCard
- Clicking shows dropdown with:
  - Reason text (varies by `needsUserInputReason`)
  - "Retry Phase" button — re-enqueues same phase, clears flags
  - "Move to Backlog" button — moves to BACKLOG, clears flags

## UI: Task Detail Banner

When `task.needsUserInput` is true:

- Warning banner at top of task detail header
- Reason text:
  - Crashed: "This agent was interrupted when the app closed"
  - MaxRetries: "This agent stalled repeatedly and stopped after 3 retries"
  - Error: "This agent exited with an error"
- Same two action buttons: Retry Phase, Move to Backlog
- Both actions clear `needsUserInput`, `needsUserInputReason`, and `stallRetryCount`

## UI: Settings

- General tab: "Stall timeout" number input (minutes), defaults to 3
- PhaseEditDialog: optional "Stall timeout override" number input (minutes), blank = use global

## Files Changed

| File | Change |
|------|--------|
| `types.d.ts` | Add enum, new fields on AITask, AIPipelinePhase, AIAutomationSettings |
| `src/electron/storage/store.ts` | Default `stallTimeoutMinutes: 3` |
| `src/electron/ai-automation/task-manager.ts` | Add `recoverStaleTasks()` |
| `src/electron/main.ts` | Call `recoverStaleTasks()` on startup |
| `src/electron/ai-automation/agent-runner.ts` | Stall detection interval, retry logic, stallRetryCount reset |
| `src/ui/components/ai-automation/TaskCard.tsx` | Warning badge + dropdown |
| `src/ui/views/AITaskDetail.tsx` | Warning banner + actions |
| `src/ui/views/AISettings.tsx` | Stall timeout in General tab |
| `src/ui/components/ai-automation/PhaseEditDialog.tsx` | Per-phase stall timeout field |
