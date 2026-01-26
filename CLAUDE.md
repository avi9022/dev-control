# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev                 # Run both React dev server and Electron in parallel
npm run dev:react          # Run only Vite dev server (port 5123)
npm run dev:electron       # Run only Electron (with auto-restart on changes)
npm run build              # Build both TypeScript and React for production
npm run transpile:electron # Compile Electron TypeScript to dist-electron/
npm run lint               # Run ESLint
```

**Note:** This project has no test suite.

---

## Architecture Overview

Multi-process Electron + React application for managing local development services.

### Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Process                         │
│  src/ui/                                                    │
│  React 19 + Context API + Radix UI + Tailwind               │
│  Communicates ONLY via window.electron API                  │
└─────────────────────┬───────────────────────────────────────┘
                      │ IPC (invoke/send)
┌─────────────────────┴───────────────────────────────────────┐
│                    Preload Layer                            │
│  src/electron/preload.cts                                   │
│  Context isolation + validates IPC + exposes window.electron│
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────────┐
│                    Main Process                             │
│  src/electron/main.ts                                       │
│  Node.js + system access + child processes + file I/O       │
└─────────────────────────────────────────────────────────────┘
```

### IPC Communication Patterns

**Request-Response (invoke):**
```typescript
// UI calls
const dirs = await window.electron.getDirectories()

// Main handles (src/electron/main.ts)
ipcMainHandle('getDirectories', async () => { ... })
```

**Push Notifications (send):**
```typescript
// Main pushes
ipcWebContentsSend('logs', { dirId, log })

// UI subscribes
window.electron.subscribeLogs((data) => { ... })
```

---

## Directory Structure

```
src/
├── electron/                    # Main process (Node.js)
│   ├── main.ts                 # App entry, IPC handlers, window management
│   ├── preload.cts             # IPC bridge, window.electron API
│   ├── pathResolver.ts         # Dev vs production paths
│   ├── functions/              # Business logic
│   │   ├── run-service.ts      # Child process spawning
│   │   ├── poll-ports.ts       # Service status polling (500ms)
│   │   ├── add-directories.ts  # Directory scanning & detection
│   │   ├── workflows.ts        # Workflow CRUD operations
│   │   └── logs.ts             # Log file operations
│   ├── sqs/                    # AWS SQS integration
│   │   ├── client.ts           # SQS client (localhost:9324)
│   │   ├── list-queues.ts      # Queue listing & polling
│   │   ├── queue-operations.ts # CRUD, send, receive, purge
│   │   └── message-store.ts    # Message archiving
│   ├── storage/
│   │   └── store.ts            # electron-store schema
│   └── utils/
│       ├── ipc-handle.ts       # Typed IPC wrapper
│       └── validate-frame.ts   # Security validation
│
├── ui/                         # Renderer process (React)
│   ├── App.tsx                 # Root with context providers
│   ├── main.tsx                # React entry point
│   ├── views/                  # Detail panels
│   │   ├── Service.tsx         # Terminal + Settings tabs
│   │   ├── Queue.tsx           # Queue management tabs
│   │   └── Tool.tsx            # Developer tools
│   ├── components/             # UI components
│   │   ├── sidebar/            # ServicesMenu, QueuesMenu, WorkflowsMenu, ToolsMenu
│   │   ├── service/            # DirectoryTab, Terminal, ServiceSettings
│   │   ├── queue/              # QueueMessage, QueueDataCards, NewQueueForm
│   │   ├── workflow/           # WorkflowDialog, WorkflowsList
│   │   └── tools/              # 21 developer tools (see Features)
│   ├── contexts/               # React Context providers
│   │   ├── DirectoriesContext.tsx
│   │   ├── QueuesContext.tsx
│   │   ├── WorkflowsContext.tsx
│   │   ├── LoggerContext.tsx   # Log caching (1000 lines max)
│   │   ├── ToolsContext.tsx
│   │   └── ViewsContext.tsx    # Multi-view management
│   ├── hooks/                  # Custom React hooks
│   └── overlay/                # Todo widget overlay window
│
└── components/ui/              # Radix UI primitives + shadcn
```

---

## Features & Capabilities

### 1. Service Management
- **Add Services**: Multi-select folder picker, recursively finds `package.json`
- **Auto-Detection**: Detects run command (prioritizes: dev, start, serve, develop, local, watch)
- **Smart Port Detection**: CLI flags → .env files → framework configs → dynamic parsing
- **Frontend Detection**: React, Vue, Next, Vite, Svelte, Angular, Preact, Parcel
- **States**: `RUNNING` | `INITIALIZING` | `STOPPED` | `UNKNOWN`
- **Actions**: Run, Stop, Open in Browser, Open in VS Code

### 2. Workflow Management
- Group multiple services to run together
- Create, edit, delete workflows
- Start all services in a workflow with one click

### 3. AWS SQS Queue Management
- Connects to local SQS (`localhost:9324` - ElasticMQ)
- Operations: List, Create, Delete, Purge, Send, Receive
- Message archiving (last 5 messages per queue)
- Real-time polling (500ms queue list, 5s queue data)

### 4. Developer Tools (21 tools)
| Category | Tools |
|----------|-------|
| Encoding | JWT Decoder, Base64, URL Encoder, HTML Escaper |
| Formatting | JSON Formatter, JSON Diff, XML↔JSON, YAML↔JSON, JSON→XLSX |
| Generators | UUID (v4/v7), Hash (MD5/SHA), Password, Lorem Ipsum |
| Time | Unix Timestamp, Timezone Converter |
| Text | Regex Tester, Case Converter, Text Diff, Text Stats |
| Network | HTTP Status Codes, cURL to Code |

### 5. Todo Widget & Important Values
- Overlay window (Cmd+Shift+T / Ctrl+Shift+T)
- Per-date todo files, priority levels
- Important values key-value storage
- File watching for external changes

### 6. Log Management
- Real-time streaming: Main → Preload → Context → UI
- File persistence: `{userData}/logs/{dirId}.log`
- Operations: chunk loading, tail, search, range queries
- Virtual list rendering (1000-line cache max)

---

## Data Models

### DirectorySettings
```typescript
{
  id: string              // Base64-encoded path
  customLabel?: string
  path: string
  name: string
  isInitializing?: boolean
  port?: string
  packageJsonExists: boolean
  isFrontendProj: boolean
  runCommand?: string
}
```

### DirectoryState
```typescript
'RUNNING' | 'INITIALIZING' | 'STOPPED' | 'UNKNOWN'
```

### Workflow
```typescript
{
  id: string              // UUID v4
  name: string
  services: string[]      // Directory IDs
}
```

### QueueMessage
```typescript
{
  id: string
  queueUrl: string
  createdAt: number
  message: string
  receiptHandle?: string
  attributes?: Record<string, string>
}
```

### Todo
```typescript
{
  id: string
  text: string
  completed: boolean
  createdAt: string
  priority?: 'none' | 'low' | 'medium' | 'high'
}
```

---

## IPC API Reference

### Service Management
| Method | Returns | Description |
|--------|---------|-------------|
| `getDirectories()` | `DirectorySettings[]` | Get all services |
| `addDirectoriesFromFolder()` | `void` | Open folder picker, scan for package.json |
| `updateDirectory(id, data)` | `void` | Update service settings |
| `removeDirectory(id?)` | `void` | Remove service (or all if no id) |
| `runService(id)` | `void` | Start service process |
| `stopService(id)` | `void` | Stop service process |
| `checkServiceState(id)` | `DirectoryState` | Get current state |
| `openProjectInBrowser(id)` | `void` | Open in default browser |
| `openInVSCode(id)` | `void` | Open in VS Code |

### Subscriptions
| Method | Callback Data | Description |
|--------|---------------|-------------|
| `subscribeDirectories(cb)` | `DirectorySettings[]` | Directory list changes |
| `subscribeDirectoriesState(cb)` | `Map<id, state>` | State changes (500ms) |
| `subscribeLogs(cb)` | `{dirId, log}` | Real-time logs |
| `subscribeQueuesList(cb)` | `QueueSettings[]` | Queue list changes |
| `subscribeQueueData(cb)` | `{queueUrl, data}` | Queue data updates |
| `subscribeWorkflows(cb)` | `Workflow[]` | Workflow changes |

### Queue Operations
| Method | Returns | Description |
|--------|---------|-------------|
| `getQueues()` | `QueueSettings[]` | List all queues |
| `createQueue(name, options)` | `string?` | Create queue, returns URL |
| `deleteQueue(url)` | `void` | Delete queue |
| `purgeQueue(url)` | `void` | Clear all messages |
| `sendQueueMessage(url, msg)` | `void` | Send message |
| `getQueueData(url)` | `QueueData` | Get messages & attributes |
| `pollQueue(url)` | `boolean` | Start polling queue |
| `stopPollingQueue(url)` | `boolean` | Stop polling |

### Log Operations
| Method | Returns | Description |
|--------|---------|-------------|
| `getLogs(dirId)` | `string[]` | Get all logs |
| `clearLogs(dirId)` | `boolean` | Clear log file |
| `getLogsChunk(dirId, offset, limit)` | `string[]` | Paginated logs |
| `getLogsTail(dirId, limit)` | `string[]` | Last N lines |
| `getLogFileLineCount(dirId)` | `number` | Total lines (cached 5s) |
| `searchLogs(dirId, term)` | `{lineNumber, line}[]` | Search logs |
| `getLogsRange(dirId, start, end)` | `string[]` | Range of lines |

### Workflow Operations
| Method | Returns | Description |
|--------|---------|-------------|
| `getWorkflows()` | `Workflow[]` | List workflows |
| `createWorkflow(name, services)` | `void` | Create workflow |
| `updateWorkflow(id, data)` | `void` | Update workflow |
| `removeWorkflow(id)` | `void` | Delete workflow |
| `startWorkflow(id)` | `void` | Start all services |

### Todo Operations
| Method | Returns | Description |
|--------|---------|-------------|
| `getTodosForDate(date)` | `Todo[]` | Get todos for date |
| `saveTodosForDate(date, todos)` | `void` | Save todos |
| `getTodoFolderPath()` | `string` | Get storage path |
| `setTodoFolderPath(path)` | `void` | Set storage path |
| `getAvailableDates()` | `string[]` | Dates with todos |
| `selectTodoFolder()` | `string?` | Open folder picker |

---

## Adding New Features

### Adding a New IPC Handler

1. **Define types** in `types.d.ts`:
```typescript
interface EventPayloadMapping {
  // Request-response
  myNewHandler: { input: string; output: number }
  // Push notification
  myNewEvent: MyEventData
}
```

2. **Add handler** in `src/electron/main.ts`:
```typescript
ipcMainHandle('myNewHandler', async (input) => {
  // Business logic
  return result
})
```

3. **Expose in preload** (`src/electron/preload.cts`):
```typescript
myNewHandler: (input: string) => ipcInvoke('myNewHandler', input),
// Or for subscriptions:
subscribeMyEvent: (callback) => ipcOn('myNewEvent', callback),
```

4. **Use in UI**:
```typescript
const result = await window.electron.myNewHandler('test')
// Or:
useEffect(() => {
  return window.electron.subscribeMyEvent((data) => { ... })
}, [])
```

### Adding a New Developer Tool

1. **Create component** in `src/ui/components/tools/`:
```typescript
export function MyNewTool() {
  return <div>Tool UI here</div>
}
```

2. **Register in tools list** (`src/ui/contexts/ToolsContext.tsx`):
```typescript
{
  id: 'my-new-tool',
  name: 'My New Tool',
  description: 'What it does',
  category: 'formatting', // encoding, formatting, generators, time, text, network
  component: 'MyNewTool'
}
```

3. **Add to toolComponents map** (`src/ui/views/Tool.tsx`):
```typescript
const toolComponents = {
  // ...existing tools
  'my-new-tool': MyNewTool,
}
```

### Adding a New Context

1. **Create context** in `src/ui/contexts/`:
```typescript
const MyContext = createContext<MyContextType | null>(null)

export function MyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState)

  useEffect(() => {
    // Setup subscriptions
    return window.electron.subscribeMyEvent((data) => setState(data))
  }, [])

  return (
    <MyContext.Provider value={{ state, setState }}>
      {children}
    </MyContext.Provider>
  )
}

export function useMy() {
  const context = useContext(MyContext)
  if (!context) throw new Error('useMy must be within MyProvider')
  return context
}
```

2. **Add provider** in `src/ui/App.tsx`:
```typescript
<MyProvider>
  {/* existing providers */}
</MyProvider>
```

### Adding a New View

1. **Create view** in `src/ui/views/`:
```typescript
export function MyView({ id }: { id: string }) {
  return <div>View content</div>
}
```

2. **Add to ViewsContext** type and render logic

---

## Coding Standards

### React Patterns
- Prefer Context API over prop drilling
- Use Radix UI primitives for accessibility
- Functional components with hooks only
- Immutable state updates (spread operator)

### Electron Patterns
- Always validate IPC via `validateEventFrame()`
- Use typed handlers via `ipcMainHandle()`
- Never expose filesystem directly to renderer
- Use `tree-kill` for safe process termination

### TypeScript
- Electron uses `NodeNext` module system
- Use `@/*` alias for imports (maps to `./src/*`)
- All types in `types.d.ts`

### Error Handling
- Non-blocking async (catch but don't throw on logs)
- Graceful degradation
- Process termination fallback (SIGTERM → SIGKILL)

### File Organization
- Many small files over few large files
- 200-400 lines typical, 800 max
- Organize by feature/domain

---

## Key Files Quick Reference

| Purpose | File |
|---------|------|
| Main entry | `src/electron/main.ts` |
| IPC bridge | `src/electron/preload.cts` |
| Type definitions | `types.d.ts` |
| Store schema | `src/electron/storage/store.ts` |
| Process spawning | `src/electron/functions/run-service.ts` |
| Port polling | `src/electron/functions/poll-ports.ts` |
| Directory scanning | `src/electron/functions/add-directories.ts` |
| React entry | `src/ui/App.tsx` |
| Service view | `src/ui/views/Service.tsx` |
| Terminal component | `src/ui/components/service/Terminal.tsx` |
| Tools registry | `src/ui/contexts/ToolsContext.tsx` |
| Log caching | `src/ui/contexts/LoggerContext.tsx` |

---

## Polling Intervals

| What | Interval | File |
|------|----------|------|
| Port status | 500ms | `poll-ports.ts` |
| Queue list | 500ms | `list-queues.ts` |
| Queue data | 5000ms | `queue-operations.ts` |
| Log line count cache | 5000ms TTL | `logs.ts` |
