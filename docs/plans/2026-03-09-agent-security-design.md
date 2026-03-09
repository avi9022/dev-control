# Agent Security Hardening Design

## Problem

The AI Automation Kanban runs Claude Code agents with `--dangerously-skip-permissions`, giving them unrestricted access to the filesystem and shell. Agents can overreach — modifying files outside their worktree, running destructive commands, or accessing unrelated directories.

## Goal

Restrict agent scope so each agent can only operate within its task directory (`ai-task-data/{taskId}/`), which contains the worktree, agent files, and attachments. Provide role-based tool selection so users can easily configure appropriate permissions per pipeline phase.

## Architecture

Three independent security layers:

### Layer 1: Tool Restriction (`--allowedTools`)

Role-based tool selection per pipeline phase. Users select predefined roles via checkboxes, each mapping to a set of Claude Code tools:

| Role | Tools |
|------|-------|
| **Worker** | `Bash, Edit, Write, Read, Grep, Glob` |
| **Planner** | `Read, Grep, Glob, Write` |
| **Reviewer** | `Read, Grep, Glob` |
| **Git** | `Bash(git *)` |

Multiple roles can be selected (union of tools). A free-text "Custom Tools" input allows adding tools not covered by roles (e.g., `WebFetch`, `Agent`, MCP tools).

If no roles are selected and no custom tools specified, no `--allowedTools` is passed (fully permissive, backward compatible).

### Layer 2: Directory Boundary (PreToolUse Hook)

A PreToolUse hook intercepts every file operation (Edit, Write, Read, Grep, Glob) before execution. It checks whether the target path is inside the allowed directory (`ai-task-data/{taskId}/`). If outside, the hook blocks the operation (exit code 2) and feeds the reason back to the agent.

**Guard script:** A static bash script stored at `{userData}/ai-guard.sh`, written once on first use. It receives JSON on stdin with `tool_name` and `tool_input`, resolves the file path to absolute, and checks it against `ALLOWED_DIR` environment variable.

**Passed to agent via:**
```
env ALLOWED_DIR=/path/to/ai-task-data/{taskId} \
claude -p --dangerously-skip-permissions \
  --settings '{"hooks":{"PreToolUse":[{"matcher":"Edit|Write|Read|Grep|Glob","hooks":[{"type":"command","command":"/path/to/ai-guard.sh"}]}]}}' \
  ...
```

**Bash is NOT guarded** — shell commands are too creative to reliably parse. Phases that don't need Bash simply don't include it via roles. Bash risk is opt-in through the Worker role.

### Layer 3: Prompt Guidance (Soft)

The system prompt instructs agents to stay within the task directory. This is guidance, not enforcement — the hook provides the hard boundary. The prompt helps agents make correct decisions without hitting the guard.

## Data Model Changes

### `AIPipelinePhase` (types.d.ts)

Replace:
```typescript
allowedTools?: string
```

With:
```typescript
roles?: string[]       // e.g. ['worker', 'git']
customTools?: string   // free-text, e.g. 'WebFetch Agent'
```

### Phase Templates (constant)

```typescript
const PHASE_TEMPLATES = {
  implementation: { name: 'Implementation', roles: ['worker', 'git'], prompt: '...' },
  planning:       { name: 'Planning',       roles: ['planner'],       prompt: '...' },
  review:         { name: 'Code Review',    roles: ['reviewer'],      prompt: '...' },
  custom:         { name: 'Custom',         roles: [],                prompt: '' },
}
```

When creating a new phase from a template, `roles` and `prompt` are pre-filled. Fully editable after creation.

### Role-to-Tools Mapping (constant)

```typescript
const ROLE_TOOLS: Record<string, string[]> = {
  worker:   ['Bash', 'Edit', 'Write', 'Read', 'Grep', 'Glob'],
  planner:  ['Read', 'Grep', 'Glob', 'Write'],
  reviewer: ['Read', 'Grep', 'Glob'],
  git:      ['Bash(git *)'],
}
```

## Agent Runner Changes (`agent-runner.ts`)

In `spawnAgent()`:

1. **Build `--allowedTools`** from `phaseConfig.roles` + `phaseConfig.customTools`:
   - Map each role to its tools via `ROLE_TOOLS`
   - Merge all tools (union, deduplicate)
   - Append custom tools (split by comma/space)
   - Pass as `--allowedTools` argument

2. **Generate guard hook settings** and pass via `--settings`:
   - Build JSON with PreToolUse hook pointing to guard script
   - Set `ALLOWED_DIR` environment variable to `task.taskDirPath`
   - Pass via `--settings` CLI flag

3. **Add prompt guidance** in `prompt-builder.ts`:
   - Strengthen existing directory restriction language
   - Reference the task directory as the only allowed workspace

## UI Changes

### Phase Config (AISettings.tsx)

Each pipeline phase shows:
- **Roles section:** checkboxes for Worker, Planner, Reviewer, Git. Each shows role name and tool list subtitle.
- **Custom Tools:** text input below roles for additional tools.

Replaces the current `allowedTools` text input.

### New Phase Dialog

When creating a new phase, user picks a template:
- Implementation / Planning / Code Review / Custom
- Template pre-fills roles and starter prompt
- User can modify everything after creation

## Guard Script (`ai-guard.sh`)

Static bash script. Receives JSON on stdin, checks file paths against `ALLOWED_DIR`:

- For Edit/Write/Read: checks `tool_input.file_path`
- For Grep/Glob: checks `tool_input.path`
- Resolves relative paths to absolute
- Walks up path to find first existing ancestor (for new files)
- Blocks (exit 2) if path is outside allowed directory

Does NOT guard Bash commands — too fragile to parse reliably.

## Migration

- Existing phases with `allowedTools` string: migrate to `customTools` field, `roles` defaults to `[]`
- Existing phases without `allowedTools`: no change (fully permissive, backward compatible)
- Guard script is always active regardless of role configuration
