# Electron Conventions (Main Process)

## IPC Handlers

- **All handlers registered in `main.ts`** — never register IPC handlers in other files. Import the logic, register the handler in main.
- **Use `ipcMainHandle()`** — the typed wrapper in `src/electron/utils/ipc-handle.ts`. It enforces type safety and frame validation automatically.
- **Define types first** — add the handler's input/output types to `EventPayloadMapping` in `types.d.ts` before implementing.
- **Error handling** — wrap handler bodies in try/catch. Extract error messages: `err instanceof Error ? err.message : 'Operation failed'`. Throw the extracted message so the renderer gets a clean error.

```typescript
// In types.d.ts
myHandler: {
  args: [string, number]
  return: ResultType
}

// In main.ts
ipcMainHandle('myHandler', async (_event, name, count) => {
  try {
    return await doSomething(name, count)
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Operation failed')
  }
})
```

## Preload Bridge

- **All IPC exposed via `window.electron`** — defined in `src/electron/preload.cts`.
- **Request-response:** `methodName: (args) => ipcInvoke('handlerKey', args)`
- **Subscriptions:** `subscribeX: (callback) => ipcOn('eventKey', (data) => callback(data))`
- **Never expose Node.js APIs** — no `fs`, `path`, `child_process`, or `require` in the renderer. Everything goes through IPC.

## Security

- **Frame validation** — `ipcMainHandle` automatically calls `validateEventFrame()`. Never bypass this.
- **Context isolation** — always `contextIsolation: true`, `nodeIntegration: false`.
- **Input sanitization** — sanitize arguments before spawning child processes. Strip null bytes (`\0`) from strings passed to `spawn()`.
- **Directory boundaries** — AI agents are restricted to their task directory. The PreToolUse guard hook enforces this.

## Child Process Management

- **Use `tree-kill`** — never use `process.kill()` directly. Child processes may spawn sub-processes that need cleanup.
- **SIGTERM → SIGKILL** — always try graceful shutdown first, force-kill as fallback.
- **Track processes** — store running processes in a `Map<id, ChildProcess>`. Clean up on app quit.
- **Sanitize spawn arguments** — strip null bytes and validate all arguments before passing to `spawn()`.

```typescript
treeKill(process.pid!, 'SIGTERM', (err) => {
  if (err) {
    treeKill(process.pid!, 'SIGKILL', () => resolve())
  } else {
    resolve()
  }
})
```

## Storage

- **`electron-store`** — typed schema defined in `src/electron/storage/store.ts`.
- **Schema-first** — add new fields to the `Schema` type with defaults before using them.
- **Access pattern:** `store.get('key')` and `store.set('key', value)`. Keep getters in store.ts or relevant manager files.
- **Broadcast changes** — after modifying stored data, call the broadcast function so the UI updates via IPC subscription.

## AI Automation Specifics

- **Agent spawning** — Claude CLI spawned as child process with `--print --verbose --output-format stream-json --mcp-config`.
- **MCP server** — HTTP transport, dynamic port, runs in main process. Tools defined in `src/electron/ai-automation/mcp-tools/`.
- **Prompt builder** — constructs agent prompts in `prompt-builder.ts`. Sections joined with `\n\n---\n\n`. Add new sections by pushing to the `parts[]` array.
- **Task directory** — each task has `{taskDataRoot}/{taskId}/agent|attachments|worktrees|context-history/`. Agents write to `agent/`, users attach to `attachments/`.
