# Agent Mid-Task Interaction — Design

## Overview

Allow users to interrupt a running agent mid-execution and send a message, similar to how Claude Code CLI works in interactive mode. The agent stops its current work, receives the user's message, and resumes with full conversation context.

## Problem

Today, agents run in `--print` mode as one-shot processes. The user can only stop, retry, or move to another phase. There is no way to redirect an agent mid-task ("focus on the backend first", "don't touch file X", "use a different approach"). The AgentTerminal input box exists but is non-functional because stdin is closed immediately after spawn.

## Mechanism: Kill + Resume

Instead of switching to interactive mode (which loses `stream-json` structured output), use the Claude CLI's session resume capability:

1. **First spawn**: Generate a UUID session ID, pass `--session-id <uuid>` along with existing `--print --output-format stream-json` flags
2. **User sends a message**: Store the message, `tree-kill` the running process
3. **Resume**: Respawn with `--print --resume <sessionId> --output-format stream-json -- "user's message"`
4. **Agent continues**: Full prior conversation context is preserved by the CLI. The agent sees the user's message and adjusts course.

This preserves the entire existing architecture — `stream-json` parsing, stats tracking, stall detection, crash handling, phase routing — while adding real-time user interaction.

## State Changes

### AITask (types)

Add one field:

```typescript
sessionId?: string  // Claude CLI session UUID, set on first spawn, reset per phase
```

### agent-runner.ts (in-memory)

Add one map:

```typescript
const pendingUserMessages = new Map<string, string>()
```

Stores taskId → user message. Populated when the user sends a message, consumed when the process exits and needs to be resumed.

## Spawn Flow

### First spawn (no change to signature, internal changes only)

```
claude --print --session-id <uuid> --output-format stream-json \
  --system-prompt <prompt> --settings <guard> \
  --dangerously-skip-permissions \
  --allowedTools <tools> --mcp-config <config> \
  -- "task prompt"
```

- Generate UUID via `randomUUID()`
- Store on task: `updateTask(taskId, { sessionId })`

### Resume spawn (after user interruption)

```
claude --print --resume <sessionId> --output-format stream-json \
  --system-prompt <prompt> --settings <guard> \
  --dangerously-skip-permissions \
  --allowedTools <tools> --mcp-config <config> \
  -- "user's message"
```

- All flags (system prompt, settings, tools, MCP config) are passed again — they are reconstructed from phaseConfig + settings, same as the first spawn
- The session ID comes from `task.sessionId`

## Interruption Flow

1. User types message in AgentTerminal input → calls IPC handler
2. IPC handler stores message: `pendingUserMessages.set(taskId, message)`
3. IPC handler kills the process: `tree-kill(pid, 'SIGTERM')`
4. Process exits with non-zero code → `handleAgentCompletion` fires
5. `handleAgentCompletion` checks `pendingUserMessages`:
   - **Has pending message**: Extract and delete from map. Call `resumeAgent(taskId, message)` instead of normal completion logic. Return early.
   - **No pending message**: Proceed with existing logic (crash detection, phase transition, reject patterns)

## Session ID Lifecycle

- **Created**: On first spawn of a phase (new UUID per phase)
- **Persists**: Across user interruptions within the same phase
- **Reset**: When the task moves to a new phase (each phase gets a fresh session with its own system prompt and tools)
- **Cleared**: When the task moves to DONE or BACKLOG

## What Doesn't Change

- `--print` mode and `stream-json` output format
- Stats tracking (token counts, cost, context usage)
- Stall detection and crash recovery
- Phase transition logic (reject patterns, next phase routing)
- MCP tools and server
- Worktree creation and management
- Prompt building
- Guard script and security

## Edge Cases

### Multiple rapid messages

If the user sends multiple messages before the resume spawns, only the last message is stored (map overwrites). This is acceptable — the user is refining their intent. Alternative: concatenate messages with newlines.

### Kill during file edit

Claude CLI writes atomically via the Write tool. Either the edit completed or it didn't. On resume, the agent sees its tool call had no response and retries or adjusts.

### Kill during bash command

Child process tree is killed. Could leave partial state (e.g., interrupted `npm install`, `.git/index.lock`). The resumed agent will encounter the partial state and handle it. This is the same behavior as Ctrl+C in Claude Code CLI.

### Agent finishes before kill completes

Race condition: agent exits naturally at the same moment the kill signal arrives. `handleAgentCompletion` checks the pending message map — if there's a message, it resumes regardless of exit code. The user's message will be delivered in a new turn.

### App restart

The session ID is persisted on the task. On restart, if a task was mid-phase, crash recovery can attempt `--resume` with the stored session ID to continue where it left off (existing crash recovery enhancement, not required for MVP).

## UI Changes (minimal for MVP)

The AgentTerminal input box already exists. Changes:

1. `handleSend` calls a new IPC method: `window.electron.aiInterruptAgent(taskId, message)`
2. Terminal shows the user's message immediately (existing green `>` prefix)
3. Terminal shows a brief "Resuming..." indicator while the new process spawns
4. Agent output continues streaming as before

## New IPC Handler

```typescript
// types.d.ts
aiInterruptAgent: {
  args: [string, string]  // taskId, message
  return: void
}
```

## Implementation Scope

1. Add `sessionId` field to `AITask` type
2. Add `pendingUserMessages` map to agent-runner
3. Modify `spawnAgent` to generate and pass `--session-id`
4. Add `resumeAgent` function (same as spawnAgent but with `--resume` flag)
5. Modify `handleAgentCompletion` to check pending messages before processing
6. Clear `sessionId` on phase transitions
7. Add `aiInterruptAgent` IPC handler in main.ts
8. Wire AgentTerminal input to new IPC handler
9. Add preload bridge method
