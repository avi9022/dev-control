# Agent Chat View — Design

## Overview

Replace the raw terminal (`AgentTerminal`) with a structured chat view (`AgentChat`). Each pipeline phase is a separate conversation. A horizontal stepper lets the user navigate between phase chats. The active phase is interactive (user can send messages via interrupt/resume), completed phases are read-only.

## Problem

The current AgentTerminal is a flat text log — monospace, no structure, no visual distinction between agent output, tool calls, user messages, and system events. It doesn't communicate phase boundaries, and with the new interrupt/resume feature, users need a proper conversational UI.

## Layout

```
┌─────────────────────────────────────────────────────┐
│  ● Planning ✓ ──── ● Impl ✓ ──── ● Review ✓ ──── ● Impl ⚡  │  ← stepper
├─────────────────────────────────────────────────────┤
│                                          [Hide tools]│  ← toolbar
│                                                     │
│  ⚡ Agent initialized                               │  ← system event
│                                                     │
│  ┌─────────────────────────────┐                    │
│  │ I'll start by reading the   │                    │  ← agent bubble (left)
│  │ existing code to understand │                    │
│  │ the architecture...         │                    │
│  └─────────────────────────────┘                    │
│                                                     │
│  🔧 Read → src/electron/main.ts                     │  ← tool call row
│  🔧 Read → src/ui/App.tsx                           │  ← tool call row
│                                                     │
│  ┌─────────────────────────────┐                    │
│  │ Based on the code, I'll     │                    │  ← agent bubble
│  │ implement the feature by... │                    │
│  └─────────────────────────────┘                    │
│                                                     │
│                    ┌──────────────────────────┐     │
│                    │ Focus on the backend first│     │  ← user bubble (right)
│                    └──────────────────────────┘     │
│                                                     │
│  ┌─────────────────────────────┐                    │
│  │ Got it, I'll focus on the   │                    │  ← agent bubble (resumed)
│  │ backend implementation...   │                    │
│  └─────────────────────────────┘                    │
│                                                     │
│  💰 Cost: $0.0342 | 12.3s                           │  ← system event
│                                                     │
├─────────────────────────────────────────────────────┤
│  [Type a message to the agent...]          [Send]   │  ← input (active phase only)
└─────────────────────────────────────────────────────┘
```

## Stepper

- One node per `phaseHistory` entry (not per unique phase — repeated phases each get their own node)
- Nodes connected by horizontal lines
- Each node colored by phase color (from pipeline config)
- Active node has a pulsing/glow indicator
- Completed nodes show a checkmark
- Crashed/stalled nodes show a warning indicator
- Hover shows: phase name, run duration, exit event
- Click to view that phase's chat
- If 10+ entries, truncate middle with "..." showing first 2 + last 3

## Chat Messages

### Agent text (left-aligned bubble)

- Content from `assistant` event text blocks
- Rendered as markdown using `MarkdownViewer`
- Subtle background (`var(--ai-surface-1)`)
- Multiple text blocks within one turn are combined into a single bubble

### Tool calls (compact inline rows)

- Displayed between agent text bubbles
- Format: `🔧 ToolName → detail` (same formatting as current `stream-formatter.ts`)
- Muted text color, no bubble background
- Globally toggleable — a "Hide tools" / "Show tools" button in the toolbar
- When hidden, all tool call rows disappear, leaving only text and user messages

### User messages (right-aligned bubble)

- From interrupt/resume: when the user sends a message
- Accent background color (`var(--ai-accent-subtle)`)
- Parsed from `--- RESUMED (user message) ---` headers in the stream, or tracked separately via a local message list

### System events (centered, muted)

- Agent initialized, cost/duration, phase headers
- Small text, muted color, centered
- No bubble — just inline text

### Errors (red banner)

- Full-width red background, similar to existing `needsUserInput` warning
- Shows error message, crash info, stall detection

## Data Flow

### IPC change

Change `aiTaskOutput` to emit raw `ClaudeStreamEvent` objects instead of pre-formatted strings:

```typescript
// Before
ipcWebContentsSend('aiTaskOutput', mainWindow.webContents, { taskId, output: text })

// After
ipcWebContentsSend('aiTaskOutput', mainWindow.webContents, { taskId, event: ClaudeStreamEvent })
```

Update the `AITaskOutput` type accordingly. `appendTaskLog` continues writing formatted text independently.

### Active phase

- UI subscribes to `aiTaskOutput` IPC events
- Events are parsed into chat messages client-side using a shared parser
- Auto-scrolls to bottom as new messages arrive
- Input box visible, sends via `aiInterruptAgent`

### Completed phases

- Load `events.json` from `contextHistoryPath` (already saved per phase run)
- Same parser converts events into chat messages
- No input box — read-only view
- Loaded on demand when user clicks the stepper node

### Shared parser

One function used by both active and completed phase rendering:

```typescript
interface ChatMessage {
  type: 'agent-text' | 'tool-call' | 'user-message' | 'system' | 'error'
  content: string
  toolName?: string
  toolDetail?: string
  timestamp?: string
}

function parseEventsToMessages(events: ClaudeStreamEvent[]): ChatMessage[]
```

Groups consecutive text blocks from the same assistant turn into one `agent-text` message. Extracts tool calls as separate `tool-call` messages. Detects user interruption boundaries. Extracts system/result events.

## User message tracking

User messages sent via interrupt need to appear in the chat. Two approaches:

1. The `--- RESUMED (user message) ---` header is emitted by `startAgentProcess`. The parser detects this pattern and creates a `user-message` entry.
2. The UI optimistically adds the user message to the chat immediately when sent (already done — `setLines(prev => [...prev, \`> ${input}\`])`), and the parser skips the resume header to avoid duplication.

Option 2 is cleaner. The UI tracks user messages locally per phase. On reload, the resume header in the event stream serves as the fallback.

## Interaction

- Input box only shown when viewing the active phase (last `phaseHistory` entry with no `exitedAt`)
- Send button + Enter key triggers `aiInterruptAgent`
- While resuming (between kill and new stream starting), show a subtle loading indicator
- Completed phase chats: no input box, scroll freely through history

## Components

```
AgentChat/
├── AgentChat.tsx           — Main container: stepper + chat panel + input
├── PhaseStepper.tsx        — Horizontal phase history stepper
├── ChatMessageList.tsx     — Scrollable list of chat messages
├── ChatBubble.tsx          — Agent or user message bubble
├── ToolCallRow.tsx         — Compact tool call display
├── SystemEvent.tsx         — Muted system/cost text
├── chat-parser.ts          — parseEventsToMessages + shared types
```

## What Doesn't Change

- Backend agent spawning, resume, phase transitions
- Log persistence (`appendTaskLog` still writes formatted text)
- Event recording (`events.json` still saved per phase)
- Stats tracking
- Stall detection, crash recovery
- Diff viewer, comments, amendments, files tabs
