# F19: Agent Comment Resolution via MCP — Design

## Goal

Give agents structured tools to interact with the system via an MCP server, starting with the ability to resolve human review comments.

## Architecture

HTTP-based MCP server running inside the Electron main process, started on app launch. Agents connect via `--mcp-config` flag pointing to a config file in the electron directory.

## MCP Server

- **File:** `src/electron/ai-automation/mcp-server.ts`
- **Transport:** Streamable HTTP on dynamic free port
- **Lifecycle:** Start on `app.on('ready')`, stop on `app.on('before-quit')`
- **Config file:** `src/electron/mcp-config.json` (generated on startup with the dynamic port)

## Tools

| Tool | Input | Action |
|------|-------|--------|
| `resolve_comment` | `{ taskId, commentId }` | Marks comment as resolved, broadcasts to UI |
| `list_comments` | `{ taskId }` | Returns unresolved comments with IDs |

## Agent Integration

- `agent-runner.ts`: add `--mcp-config` path to spawn args
- `prompt-builder.ts`: include comment IDs in prompt, add note about available MCP tools

## Files Changed

| File | Change |
|------|--------|
| `src/electron/ai-automation/mcp-server.ts` | New — MCP server |
| `src/electron/main.ts` | Start/stop server |
| `src/electron/ai-automation/agent-runner.ts` | Add `--mcp-config` to spawn args |
| `src/electron/ai-automation/prompt-builder.ts` | Add comment IDs, MCP tools note |
