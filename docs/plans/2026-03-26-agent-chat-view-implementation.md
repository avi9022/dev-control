# F61: Agent Chat View — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the raw `AgentTerminal` with a structured chat UI. Each pipeline phase is a separate conversation, navigable via a horizontal stepper. Active phase is interactive, completed phases are read-only.

**Architecture:** Frontend-only restructuring. The backend emits raw `ClaudeStreamEvent` objects instead of formatted strings. A shared parser converts events into typed chat messages. Completed phases load from existing `events.json` files.

**Design doc:** `docs/plans/2026-03-26-agent-chat-view-design.md`

---

### Task 1: Define chat message types and build the parser

**Files:**
- Create: `src/ui/components/ai-automation/agent-chat/chat-parser.ts`

**Types:**

```typescript
enum ChatMessageType {
  AgentText = 'agent-text',
  ToolCall = 'tool-call',
  UserMessage = 'user-message',
  System = 'system',
  Error = 'error',
}

interface ChatMessage {
  id: string
  type: ChatMessageType
  content: string
  toolName?: string
  toolDetail?: string
  costUsd?: number
  durationMs?: number
  timestamp: string
}
```

**Parser function:**

```typescript
function parseEventsToMessages(events: ClaudeStreamEvent[]): ChatMessage[]
```

Logic:
- `assistant` events: iterate content blocks. Consecutive text blocks from one turn → combine into one `AgentText` message. Tool use blocks → one `ToolCall` message each with name and detail (reuse formatting logic from `stream-formatter.ts` for tool detail extraction).
- `result` events → `System` message with cost/duration.
- `system` events → `System` message (e.g., "Agent initialized").
- `error` events → `Error` message.
- `user` events → `UserMessage` (if the stream contains user events).
- Detect the `--- RESUMED (user message) ---` header pattern in text blocks → split into a `UserMessage` followed by a new `AgentText` if there's remaining content.

Also export a helper for live streaming:

```typescript
function parseEventToMessages(event: ClaudeStreamEvent): ChatMessage[]
```

Same logic but for a single event (used by the live subscription).

Generate unique IDs via a counter or `crypto.randomUUID()`.

**Verify:** `npx tsc --noEmit`

---

### Task 2: Change IPC to emit raw stream events

**Files:**
- Modify: `types/ai-automation.d.ts` — update `AITaskOutput`
- Modify: `src/electron/ai-automation/agent-runner.ts` — emit raw events

**Changes:**

**2a. Update type:**

The current `AITaskOutput` is `{ taskId: string; output: string }`. Add an event variant:

```typescript
interface AITaskStreamOutput {
  taskId: string
  event: ClaudeStreamEvent
}
```

Add a new IPC event `aiTaskStreamEvent` alongside the existing `aiTaskOutput` (keep the old one for log compatibility):

- `EventPayloadMapping`: add `aiTaskStreamEvent` with `{ return: AITaskStreamOutput; args: [AITaskStreamOutput] }`
- `Window.electron`: add `subscribeAITaskStreamEvent`

**2b. Emit raw events from agent-runner:**

In `startAgentProcess`, inside the `child.stdout` data handler, after parsing each JSON line into a `ClaudeStreamEvent`, add:

```typescript
emitStreamEvent(taskId, event)
```

Where `emitStreamEvent` is a new helper (alongside `emit`):

```typescript
function emitStreamEvent(taskId: string, event: ClaudeStreamEvent): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    ipcWebContentsSend('aiTaskStreamEvent', mainWindow.webContents, { taskId, event })
  }
}
```

The existing `emit(taskId, text)` and `appendTaskLog` remain unchanged — they continue writing formatted text for log persistence.

**2c. Preload bridge:**

Add `subscribeAITaskStreamEvent` to preload.

**Verify:** `npx tsc --noEmit` + `npm run transpile:electron`

---

### Task 3: Build the PhaseStepper component

**Files:**
- Create: `src/ui/components/ai-automation/agent-chat/PhaseStepper.tsx`

**Props:**

```typescript
interface PhaseStepperProps {
  phaseHistory: AIPhaseHistoryEntry[]
  pipeline: AIPipelinePhase[]
  activePhaseIndex: number
  onSelectPhase: (index: number) => void
}
```

**Rendering:**

- Horizontal flex row of nodes connected by lines
- Each node is a small circle, colored by phase color (look up `pipeline.find(p => p.id === entry.phase)?.color`)
- Active node (last entry without `exitedAt`): pulsing animation via CSS
- Completed nodes: checkmark icon inside
- Crashed/stalled nodes: warning icon, red/orange color
- Hover tooltip: phase name, duration (enteredAt → exitedAt), exit event
- Click handler calls `onSelectPhase(index)`
- If 10+ entries: show first 2, "..." indicator, last 3

**Styling:** Tailwind + CSS variables matching the app theme.

**Verify:** `npx tsc --noEmit`

---

### Task 4: Build ChatBubble, ToolCallRow, SystemEvent components

**Files:**
- Create: `src/ui/components/ai-automation/agent-chat/ChatBubble.tsx`
- Create: `src/ui/components/ai-automation/agent-chat/ToolCallRow.tsx`
- Create: `src/ui/components/ai-automation/agent-chat/SystemEvent.tsx`

**ChatBubble:**

```typescript
interface ChatBubbleProps {
  message: ChatMessage
}
```

- If `type === AgentText`: left-aligned bubble, `var(--ai-surface-1)` background, content rendered via `MarkdownViewer`
- If `type === UserMessage`: right-aligned bubble, `var(--ai-accent-subtle)` background, plain text
- Rounded corners, padding, max-width ~80%

**ToolCallRow:**

```typescript
interface ToolCallRowProps {
  message: ChatMessage
}
```

- Compact single line: emoji + tool name + detail
- Muted text color (`var(--ai-text-tertiary)`)
- Small font size, no bubble background
- Indent slightly to align with agent bubbles

**SystemEvent:**

```typescript
interface SystemEventProps {
  message: ChatMessage
}
```

- Centered text, muted color
- Small font, no bubble
- For cost/duration: show formatted values (`$0.0342 | 12.3s`)

**Verify:** `npx tsc --noEmit`

---

### Task 5: Build ChatMessageList component

**Files:**
- Create: `src/ui/components/ai-automation/agent-chat/ChatMessageList.tsx`

**Props:**

```typescript
interface ChatMessageListProps {
  messages: ChatMessage[]
  showToolCalls: boolean
  autoScroll: boolean
}
```

**Rendering:**

- Scrollable container (flex-1, overflow-y-auto)
- Maps through messages, renders appropriate component based on `type`:
  - `AgentText` / `UserMessage` → `ChatBubble`
  - `ToolCall` → `ToolCallRow` (hidden when `!showToolCalls`)
  - `System` → `SystemEvent`
  - `Error` → Red banner (inline, full-width)
- Auto-scroll to bottom when `autoScroll` is true and new messages arrive
- Empty state: "Waiting for agent output..."

**Verify:** `npx tsc --noEmit`

---

### Task 6: Build the main AgentChat component

**Files:**
- Create: `src/ui/components/ai-automation/agent-chat/AgentChat.tsx`
- Create: `src/ui/components/ai-automation/agent-chat/index.ts` (barrel export)

**Props:**

```typescript
interface AgentChatProps {
  task: AITask
  pipeline: AIPipelinePhase[]
}
```

**State:**

- `selectedPhaseIndex: number` — which phase history entry is being viewed
- `showToolCalls: boolean` — toggle for tool call visibility
- `activeMessages: ChatMessage[]` — live messages for the active phase
- `completedMessages: ChatMessage[]` — parsed messages for a completed phase
- `userMessages: string[]` — locally tracked user messages for the active phase

**Behavior:**

- On mount, default `selectedPhaseIndex` to the last entry (active or most recent)
- When viewing a completed phase: load `events.json` from `contextHistoryPath` via `window.electron.aiReadContextHistory`, parse with `parseEventsToMessages`
- When viewing the active phase: subscribe to `subscribeAITaskStreamEvent`, parse each event with `parseEventToMessages`, append to `activeMessages`
- When user sends a message: call `window.electron.aiInterruptAgent`, add `UserMessage` to local state immediately
- Toolbar has a toggle button for tool calls

**Layout:**

```
<div className="h-full flex flex-col">
  <PhaseStepper ... />
  <div className="toolbar"> [Hide/Show tools toggle] </div>
  <ChatMessageList ... />
  {isActivePhase && <InputBar ... />}
</div>
```

**InputBar:** Same as current AgentTerminal input — text input + send button. Only shown when `selectedPhaseIndex` is the active phase.

**Verify:** `npx tsc --noEmit`

---

### Task 7: Replace AgentTerminal with AgentChat in AITaskDetail

**Files:**
- Modify: `src/ui/views/AITaskDetail.tsx`

**Changes:**

- Replace `AgentTerminal` import with `AgentChat` import
- Replace usage:

```typescript
// Before
<AgentTerminal taskId={task.id} needsUserInput={task.needsUserInput} />

// After
<AgentChat task={task} pipeline={pipeline} />
```

- Pass the board's pipeline to `AgentChat`. The pipeline is already available in the task detail context (look up from `task.boardId`).
- Rename the tab label from "terminal" to "chat" (or keep as "terminal" if preferred).

**Verify:** `npx tsc --noEmit` + `npm run transpile:electron`

---

### Task 8: Load completed phase events via IPC

**Files:**
- Possibly modify: `src/electron/handlers/ai-handlers.ts`

**Check:** The existing `aiReadContextHistory` IPC handler already returns `{ prompt: string; events: string }` — the `events` field is the raw `events.json` content as a string. The chat parser can `JSON.parse(events)` to get `ClaudeStreamEvent[]`.

No new IPC handler needed — reuse `aiReadContextHistory`. The `AgentChat` component calls it when the user clicks a completed phase in the stepper.

**Verify:** Confirm the existing handler returns the data the parser needs.

---

### Task 9: Verify and test

**Verify:**
1. `npx tsc --noEmit` — UI type check
2. `npm run transpile:electron` — Electron type check
3. `npm run lint` — no new lint errors
4. `npm run build` — production build

**Manual testing:**
1. Start a task, watch the active phase render as a chat with agent bubbles and tool rows
2. Toggle "Hide tools" — tool rows disappear, only text and system events remain
3. Send a user message — user bubble appears, agent resumes and responds
4. Let the phase complete, move to next phase — stepper updates, new chat starts
5. Click a completed phase in the stepper — loads that phase's chat history (read-only, no input)
6. Multiple phase iterations — stepper shows all entries, navigation works
7. Crash/stall — stepper node shows warning indicator
