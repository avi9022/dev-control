# Context History Feature Design

## Goal

Give users full transparency into what context each agent phase received and how the conversation evolved, so they can debug and optimize agent performance.

## Storage

Per agent phase run, create: `{taskDirPath}/context-history/{phaseId}-{timestamp}/`

- `prompt.md` — exact output of `buildPrompt()`, saved before spawning
- `events.json` — array of raw stream-json events appended during the run (assistant, user, result, error events)

`AIPhaseHistoryEntry` gets a new optional field `contextHistoryPath` pointing to this directory.

## UI

History tab entries with `contextHistoryPath` show a clickable icon button. Clicking opens `ContextHistoryModal` — a full-size tabbed modal:

- **Prompt tab** — renders `prompt.md` as formatted markdown sections
- **Conversation tab** — chat-style view (assistant/tool messages) with toggle to raw JSON

## Files Changed

- `types.d.ts` — add `contextHistoryPath` to `AIPhaseHistoryEntry`
- `agent-runner.ts` — save prompt.md, append events.json, set contextHistoryPath
- `task-dir-manager.ts` — helpers for context-history directory
- `AITaskDetail.tsx` — context button in history tab, modal state
- `ContextHistoryModal.tsx` — new component
