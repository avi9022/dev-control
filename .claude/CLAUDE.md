# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev                 # Run both React dev server and Electron in parallel
npm run dev:react          # Run only Vite dev server (port 5123)
npm run dev:electron       # Run only Electron (with auto-restart on changes via nodemon)
npm run transpile:electron # Compile Electron TypeScript to dist-electron/
npm run build              # Build both TypeScript and React for production
npm run lint               # Run ESLint
```

**Note:** This project has no test suite.

---

## Architecture Overview

Multi-process Electron + React application for managing local development services, databases, Docker containers, message brokers, and developer tools.

### Three-Layer Architecture

```
Renderer Process (src/ui/)
  React 19 + Context API + Radix UI + Tailwind
  Communicates ONLY via window.electron API
        │ IPC (invoke/send)
Preload Layer (src/electron/preload.cts)
  Context isolation + validates IPC + exposes window.electron
        │
Main Process (src/electron/main.ts)
  Node.js + system access + child processes + file I/O
```

### IPC Communication Patterns

All IPC is typed via `EventPayloadMapping` in `types.d.ts`.

**Request-Response (invoke):** UI calls `window.electron.methodName()` → main handles via `ipcMainHandle('methodName', handler)`

**Push Notifications (send):** Main pushes via `ipcWebContentsSend('event', data)` → UI subscribes via `window.electron.subscribeEvent(callback)`

---

## Directory Structure

```
src/
├── electron/                    # Main process (Node.js)
│   ├── main.ts                 # App entry, ALL IPC handler registrations, window management
│   ├── preload.cts             # IPC bridge, window.electron API definition
│   ├── pathResolver.ts         # Dev vs production paths
│   ├── functions/              # Service management logic
│   │   ├── run-service.ts      # Child process spawning (node-pty)
│   │   ├── poll-ports.ts       # Service status polling (500ms)
│   │   ├── add-directories-from-folder.ts  # Directory scanning & package.json detection
│   │   ├── open-in-ide.ts      # Dynamic IDE detection (VS Code, Cursor, Windsurf, Zed)
│   │   └── ...                 # CRUD operations for directories, workflows, queues
│   ├── sql/                    # Oracle DB backend (oracledb)
│   ├── mongodb/                # MongoDB backend
│   ├── dynamodb/               # DynamoDB backend (@aws-sdk)
│   ├── docker/                 # Docker CLI wrapper
│   ├── api-client/             # HTTP request executor + Postman import/export
│   ├── brokers/                # Message broker abstraction (ElasticMQ + RabbitMQ)
│   ├── sqs/                    # Legacy SQS integration (localhost:9324)
│   ├── storage/                # electron-store schema + getters
│   └── utils/                  # IPC wrappers, frame validation, port detection, log manager
│
├── ui/                         # Renderer process (React)
│   ├── App.tsx                 # Root with context providers
│   ├── views/                  # Detail panels (Service, SQL, MongoDB, DynamoDB, Docker,
│   │                           #   ApiClient, Queue, Tool, TableDetail)
│   ├── components/
│   │   ├── AppSidebar/         # Sidebar menus for each feature area
│   │   ├── service/            # Terminal, ServiceSettings
│   │   ├── sql/                # SQLEditor, ResultsGrid, SchemaObjectContextMenu, table-detail/
│   │   ├── mongodb/            # DocumentList, QueryBar, AggregationBuilder, SchemaView
│   │   ├── dynamodb/           # QueryBuilder, ItemEditor, InlineCellEditor
│   │   ├── docker/             # ContainerList, ImageList, VolumeList, NetworkList, files/
│   │   ├── api-client/         # RequestPanel, ResponsePanel, EnvironmentManager, Variables
│   │   ├── queue/              # QueueMessage, QueueDataCards, NewQueueForm
│   │   ├── workflow/           # WorkflowEditor, WorkflowStepForm, WorkflowProgressPanel
│   │   └── tools/              # 21+ developer tools
│   ├── contexts/               # React Context providers (one per feature area)
│   ├── hooks/                  # Custom React hooks
│   └── overlay/                # Todo widget overlay window
│
└── components/ui/              # Radix UI primitives + shadcn
```

---

## Major Features

### Service Management

- Auto-detects `package.json`, run commands, ports, and frontend frameworks
- Process spawning via `node-pty`, states: `RUNNING | INITIALIZING | STOPPED | UNKNOWN`
- Dynamic IDE detection: opens in VS Code, Cursor, Windsurf, or Zed (`src/electron/functions/open-in-ide.ts`)
- Open in Browser, Open in Finder

### Database Tools

- **Oracle SQL** (`src/electron/sql/`): Full SQL IDE — worksheets, schema browser, explain plan, DBMS_OUTPUT, query history, saved queries. Uses `oracledb`.
- **MongoDB** (`src/electron/mongodb/`): Document CRUD, aggregation pipeline builder, schema analyzer, index management, collection import/export. Uses `mongodb`.
- **DynamoDB** (`src/electron/dynamodb/`): Table browser, scan/query builder, inline cell editing. Supports custom endpoint, AWS credentials, or AWS profile. Uses `@aws-sdk/client-dynamodb`.

### Docker Management (`src/electron/docker/`)

- Containers: list, start, stop, restart, pause, remove, inspect, exec (interactive PTY), logs, stats
- Images, volumes, networks: full CRUD
- Docker Compose: list projects, up/down/restart
- Container file manager: browse filesystem, upload/download files
- Detects Docker availability without requiring active daemon

### API Client (`src/electron/api-client/`)

- Postman-like HTTP client with workspaces, collections, folders, requests
- Environment variables with resolution in URLs, headers, and body
- Auth types: bearer, basic, api-key, OAuth2, digest, hawk, AWS Sig V4, NTLM
- Postman collection/environment import and export
- Code snippet generation

### Message Brokers (`src/electron/brokers/`)

- Abstraction layer supporting both **ElasticMQ** and **RabbitMQ**
- Queue operations: list, create, delete, purge, send, receive
- Message archiving (last 5 per queue)
- Legacy SQS module still exists at `src/electron/sqs/`

### Workflows (`src/ui/components/workflow/`)

- Step-based execution engine with separate start and stop sequences
- Three step types: `command` (shell), `docker` (container control), `service` (local services)
- Per-step config: timeout, retries, continueOnError
- Real-time progress tracking and execution history

### Developer Tools (21+)

Registered in `src/ui/contexts/tools.tsx`, rendered via `src/ui/views/Tool.tsx` toolComponents map. Categories: encoding, formatting, generators, time, text, network.

### Todo Widget & Auto-Updates

- Overlay window (Cmd+Shift+T), per-date todo files, priority levels, important values storage
- Auto-update detection with user prompt/refuse/apply flow

---

## Adding New Features

### Adding a New IPC Handler

1. **Define types** in `types.d.ts` under `EventPayloadMapping`:

```typescript
myNewHandler: {
  input: string;
  output: number;
}
```

2. **Add handler** in `src/electron/main.ts`:

```typescript
ipcMainHandle("myNewHandler", async (input) => {
  return result;
});
```

3. **Expose in preload** (`src/electron/preload.cts`):

```typescript
myNewHandler: (input: string) => ipcInvoke('myNewHandler', input),
```

4. **Use in UI**: `await window.electron.myNewHandler('test')`

For push notifications, use `ipcWebContentsSend` in main and `ipcOn` in preload with a `subscribe*` method.

### Adding a New Developer Tool

1. Create component in `src/ui/components/tools/`
2. Register in tools list in `src/ui/contexts/tools.tsx`
3. Add to `toolComponents` map in `src/ui/views/Tool.tsx`

### Adding a New Context

1. Create in `src/ui/contexts/` (pattern: `createContext` + Provider component + `useX` hook)
2. Wire subscriptions to `window.electron.subscribe*` in `useEffect`
3. Add provider wrapper in `src/ui/App.tsx`

### Adding a New View

1. Create view in `src/ui/views/`
2. Add to `ViewsContext` type and render logic

---

## Coding Standards

Detailed rules are in `.claude/rules/`:
- **`.claude/rules/general.md`** — TypeScript, file organization, naming, error handling
- **`.claude/rules/ui.md`** — React components, state management, hooks, styling, IPC subscriptions
- **`.claude/rules/electron.md`** — IPC handlers, preload bridge, security, child processes, storage

---

## Key Files Quick Reference

| Purpose                          | File                                    |
| -------------------------------- | --------------------------------------- |
| Main entry + all IPC handlers    | `src/electron/main.ts`                  |
| IPC bridge + window.electron API | `src/electron/preload.cts`              |
| All type definitions             | `types.d.ts`                            |
| Store schema                     | `src/electron/storage/store.ts`         |
| Process spawning                 | `src/electron/functions/run-service.ts` |
| IDE detection                    | `src/electron/functions/open-in-ide.ts` |
| Port polling                     | `src/electron/functions/poll-ports.ts`  |
| React entry + providers          | `src/ui/App.tsx`                        |
| Tools registry                   | `src/ui/contexts/tools.tsx`             |

---

## Polling Intervals

| What                 | Interval   | Location              |
| -------------------- | ---------- | --------------------- |
| Port status          | 500ms      | `poll-ports.ts`       |
| Queue list           | 500ms      | `list-queues.ts`      |
| Queue data           | 5000ms     | `queue-operations.ts` |
| Log line count cache | 5000ms TTL | log file manager      |
