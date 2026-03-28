# DevControl

A desktop application for managing your local development environment and automating coding tasks with AI agents.

Built with Electron, React 19, and TypeScript.

## Features

### AI Task Automation (Kanban)

Manage coding tasks on a kanban board with AI agents that do the work for you.

- **Customizable pipeline** - define your own phases (planning, implementation, review, etc.) with visual flow editor
- **AI agents per phase** - each phase runs a Claude agent with role-based tool restrictions
- **Mid-task interaction** - interrupt running agents, send messages, redirect their work in real-time
- **Chat view** - structured conversation UI per phase with markdown rendering, tool call visibility toggle, and phase history stepper
- **Multiple boards** - organize work across different projects or teams
- **Worktree management** - automatic git worktree creation per task for isolated development
- **Diff viewer** - review agent changes with inline commenting and search
- **Task amendments** - add new requirements to tasks mid-pipeline
- **Crash recovery & stall detection** - automatic retry with exponential backoff
- **Notifications** - native OS notifications and in-app alerts for task events
- **AI Planner** - describe a goal in natural language, get tasks created automatically

### Service Management

- Auto-detect `package.json` projects with run commands, ports, and frameworks
- Start/stop services with real-time terminal output via node-pty
- Dynamic IDE detection (VS Code, Cursor, Windsurf, Zed)
- Port status monitoring

### Database Tools

- **Oracle SQL** - full SQL IDE with worksheets, schema browser, explain plan, query history
- **MongoDB** - document CRUD, aggregation pipeline builder, schema analyzer, index management
- **DynamoDB** - table browser, scan/query builder, inline cell editing with custom endpoint support

### Docker Management

- Containers, images, volumes, networks - full CRUD
- Docker Compose project management
- Container file browser with upload/download
- Interactive exec terminal
- Live stats and logs

### API Client

- Postman-like HTTP client with workspaces, collections, and folders
- Environment variables with resolution in URLs, headers, and body
- Auth types: Bearer, Basic, API Key, OAuth2, Digest, Hawk, AWS Sig V4, NTLM
- Postman import/export
- Code snippet generation

### Message Brokers

- ElasticMQ and RabbitMQ support
- Queue operations: create, delete, purge, send, receive
- Message archiving

### Workflows

- Step-based execution engine with start and stop sequences
- Step types: shell command, Docker container control, local service management
- Per-step config: timeout, retries, continueOnError
- Real-time progress tracking

### Developer Tools

21+ built-in tools: JSON formatter, Base64 encoder/decoder, UUID generator, timestamp converter, JWT decoder, hash generator, regex tester, URL encoder, color converter, Lorem Ipsum generator, cron expression parser, and more.

## Installation

### Download

Download the latest release for your platform from the [Releases](https://github.com/avi9022/dev-control/releases) page:

- **macOS** - `.dmg` (universal, works on Intel and Apple Silicon)
- **Windows** - `.exe` installer
- **Linux** - `.AppImage` or `.deb`

### Build from source

```bash
git clone https://github.com/avi9022/dev-control.git
cd dev-control
npm install
npm run dev
```

### Build for distribution

```bash
npm run build:mac     # macOS
npm run build:win     # Windows
npm run build:linux   # Linux
npm run build:dist    # All platforms
```

## Tech Stack

- **Frontend** - React 19, Tailwind CSS, Radix UI, CodeMirror, xterm.js, Three.js
- **Backend** - Electron (Node.js), node-pty, electron-store
- **Databases** - oracledb, mongodb, @aws-sdk/client-dynamodb
- **AI** - Claude CLI (spawned as child process), MCP server (HTTP transport)
- **Build** - Vite, TypeScript, electron-builder

## Requirements

- Node.js 20+
- npm 9+
- For AI features: [Claude Code CLI](https://claude.ai/code) installed

## License

This software is licensed for **personal, non-commercial use only**. See [LICENSE](LICENSE) for details.
