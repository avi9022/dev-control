# F46: Task Cross-References — Design

## Overview

Allow tasks to reference other tasks using `#shortId` syntax in descriptions and amendments. Linked tasks provide context to agents via the prompt builder, with full filesystem access to explore related task directories on demand.

## Syntax & Input

- `#shortId` syntax — first 8 characters of the task UUID (e.g., `#a1b2c3d4`)
- Autocomplete dropdown triggered by typing `#` in description and amendment text fields
  - Reuses the existing project tagging component pattern — searches by task title, displays short ID
  - Raw `#id` also works via copy-paste without autocomplete
- Supported in: task descriptions, amendment text

## Data Model

New field on `AITask`:

```typescript
linkedTaskIds?: string[]  // Full UUIDs of referenced tasks
```

- Parsed from description + amendments text on save (extract all `#xxxxxxxx` patterns, resolve to full UUIDs)
- One-directional only — if Task A links Task B, Task B has no automatic back-reference
- Invalid references (no matching task) are ignored silently

## UI Rendering

- `#shortId` tokens in description/amendment text rendered as clickable chips
- Chip shows resolved task title (e.g., `#a1b2c3d4 Add login API`)
- Hover tooltip: task title, current phase, board name
- Click navigates to the linked task's detail view

## Agent Context (Prompt Builder)

For each linked task, append a `## Related Tasks` section to the prompt:

```markdown
## Related Tasks

The following tasks are related to this work. Use subagents to explore their task directories if you need more context — do not read everything upfront.

- #a1b2c3d4 — "Add login API" [phase: code-review]
  Build POST /auth/login with email/password validation and JWT token generation for the SuperCart mobile app...
  Task directory: /Users/avi/devcontrol-data/a1b2c3d4/

- #e5f6g7h8 — "Create user model" [phase: done]
  Define the User schema with fields for email, hashed password, profile...
  Task directory: /Users/avi/devcontrol-data/e5f6g7h8/
```

- Description truncated to first 200 characters
- Includes current phase name so the agent knows the state of related work
- Full task directory path — agent uses native filesystem access to explore
- Instruction to use subagents for exploration to avoid context bloat in the main agent

## Scope Boundaries

- **No bidirectional links** — only forward references are stored and shown
- **No dependency/blocking enforcement** — purely informational context sharing
- **No new MCP tools** — agents use existing filesystem access
- **No comments/diffs in prompt** — agent pulls these on demand from the task directory

## Implementation Notes

### Parsing

- Regex: `/#([a-f0-9]{8})\b/g` to extract short IDs from text
- Resolve short ID to full UUID by prefix-matching against all tasks on the same board
- Run parser on description + all amendment texts on task save/update

### Autocomplete Component

- Reuse the project tagging dropdown pattern (same trigger/positioning logic)
- Trigger character: `#` (vs whatever the project tagger uses)
- Data source: all tasks on the current board (excluding self)
- Display: task title + short ID + phase badge
- On select: insert `#shortId` into text at cursor position

### Prompt Builder Changes

- In `prompt-builder.ts`, after building the main prompt sections, check `linkedTaskIds`
- For each linked task ID, load the task, format the reference block
- Append the `## Related Tasks` section with the subagent exploration instruction
