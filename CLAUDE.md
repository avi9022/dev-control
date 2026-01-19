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

## Architecture Overview

Multi-process Electron + React application for managing local development services.

### Three-Layer Architecture

**1. Main Process** (`src/electron/main.ts`)
- Node.js process with system-level access
- Spawns and manages child processes (local services)
- Handles file I/O, service logs, and data persistence
- Exposes functionality via typed IPC handlers

**2. Preload Layer** (`src/electron/preload.cts`)
- Security boundary with context isolation enabled
- Exposes controlled API surface via `window.electron`
- Validates all IPC messages before execution

**3. Renderer Process** (`src/ui/`)
- React application with no direct system access
- Communicates exclusively through `window.electron` API
- Uses React Context for state management (no Redux/Zustand)

### IPC Communication Patterns

**Request-Response (invoke):**
```typescript
// UI calls
const dirs = await window.electron.getDirectories()

// Main handles
ipcMainHandle('getDirectories', async () => { ... })
```

**Push Notifications (send):**
```typescript
// Main pushes
ipcWebContentsSend('logs', { dirId, log })

// UI subscribes
window.electron.subscribeLogs((data) => { ... })
```

### Core Concepts

**Services (Directories)**
- Node.js projects with `package.json` and a run command
- Each has unique ID (base64-encoded path)
- Lifecycle: STOPPED → INITIALIZING → RUNNING
- Logs streamed to UI and persisted to disk in real-time

**Service Management Flow:**
1. User adds directory via file picker
2. System recursively finds all `package.json` files
3. Auto-detects run script (prioritizes: dev, start, serve, develop, local, watch)
4. Stores in electron-store with metadata
5. User runs service → spawns child process
6. Port polling (500ms) detects when service is reachable
7. Logs stream to UI via IPC and append to disk file

**Workflows** - Collections of services to run together

**Log Management**
- Each service has dedicated log file: `{userData}/logs/{dirId}.log`
- Real-time streaming: Main → Preload → Context → Component
- File-based operations: chunk loading, tail, search, range queries
- Line count cached for 5 seconds (TTL) to reduce disk reads

**Queues (AWS SQS)** - Lists queues with polling, can send/purge/create/delete

### Key Files

**Types & API Surface:**
- `types.d.ts` - Global TypeScript definitions including `window.electron` API
- `src/electron/storage/store.ts` - electron-store schema definition

**Process Management:**
- `src/electron/functions/run-service.ts` - Child process spawning
- `src/electron/functions/poll-ports.ts` - Service status polling
- Uses `tree-kill` for safe process termination

**IPC Layer:**
- `src/electron/utils/ipc-handle.ts` - Typed IPC handlers with validation
- All handlers registered in `src/electron/main.ts`
- All APIs exposed in `src/electron/preload.cts`

**Data Persistence:**
- `electron-store` for configuration (directories, workflows, settings)
- File system for logs (`{userData}/logs/{dirId}.log`)

## Coding Standards

See `.cursor/rules.md` for base rules.

**React Patterns:**
- Prefer Context API over prop drilling
- Use Radix UI primitives for accessibility

**Electron Patterns:**
- Always validate IPC messages via `validateEventFrame()`
- Use typed IPC handlers via `ipcMainHandle()`
- Never expose filesystem directly to renderer

**TypeScript:**
- Electron code uses `NodeNext` module system
- Use `@/*` alias for imports (maps to `./src/*`)
- Electron uses `pathResolver.ts` for Vite dev vs production paths

**Error Handling:**
- Preserve all error handling and safety checks
- Gracefully handle process failures (fallback to lsof for stale processes)
