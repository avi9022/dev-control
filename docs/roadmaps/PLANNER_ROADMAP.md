# AI Task Planner — Roadmap

The planner is a conversational agent that helps users break down goals into actionable tasks. This roadmap tracks its evolution from basic task creation to full project orchestration.

## Completed

- [x] **P1**: Core Planner — conversational chat UI, Claude CLI with MCP tools, creates tasks and boards
- [x] **P2**: Knowledge Doc Access — planner reads project knowledge docs via MCP tools
- [x] **P3**: Debug Panel — expandable stream events, session IDs, auto-save conversations
- [x] **P4**: Better Task Descriptions — system prompt enforces self-contained, context-rich descriptions
- [x] **P5**: Project Creation — planner detects new project needed, asks user to confirm, opens modal (name, location, git init, board selection), project created and registered before tasks are created
- [x] **P6**: Instant First Message — greeting shown from UI immediately, agent only spawns on first user message
- [x] **P7**: Project Tagging in Tasks — planner passes projectPaths to create_task, system prompt instructs to always include project path, tool description reinforced
- [x] **P14**: Markdown Message Rendering — assistant messages rendered as parsed markdown with react-markdown, styled with theme variables

## Planned

- [x] **P8**: Conversation Management — "New" button + history popover with past conversations, click to load, first user message as summary with relative timestamps
- [ ] **P9**: Task Cross-References — planner links related tasks using `#shortId` syntax so agents can explore sibling task directories
- [ ] **P10**: Task Dependencies — planner marks task ordering (e.g., "create skeleton" blocks "add first feature") using F48 dependency system
- [ ] **P11**: Template Scaffolding — after creating a project, planner can run scaffold commands (`npm init`, `create-react-app`, etc.) via a new MCP tool
- [ ] **P12**: Pipeline Selection — planner suggests which pipeline phases each task should go through based on the task type (e.g., documentation tasks skip code review)
- [ ] **P13**: Multi-Project Planning — planner can create tasks spanning multiple projects in a single session (e.g., API + frontend + shared library)
- [x] **P15**: Rich Input — MentionEditor with @project and #task tagging, file attachments via picker, Enter to send / Shift+Enter for newline
- [x] **P16**: Batch Task Creation — `create_tasks` MCP tool accepts JSON array of tasks, creates all in one call. Planner prompt updated to use it instead of individual `create_task` calls.
- [ ] **P17**: Live Action Indicators — replace the generic "Thinking..." spinner with real-time status showing what the planner is doing: "Listing projects...", "Creating board...", "Creating task 3/5...". Parse tool_use events from the stream to detect which tool is being called and show a descriptive label. Progress count for batch operations (e.g., task creation).
- [ ] **P18**: Planner Task Attachments — allow the planner to attach files to tasks it creates. When the user attaches files in the chat, the planner can pass them through to specific tasks via an `attachments` parameter on `create_task`. Files are copied into the task's attachments directory and included in the agent's context when the task runs.
- [ ] **P19**: CTA Messages — planner messages can include call-to-action buttons alongside text. When the planner wants to perform an action that needs user consent (e.g., create project, create board, run a script), the message renders with action buttons like [Create Project] [Skip]. Clicking a CTA sends a predefined response back to the planner or triggers a tool call directly. Prevents the planner from taking actions without explicit user approval.

## Backlog

- [ ] **P20**: Cost Estimation — planner estimates token/cost usage for the planned tasks based on description complexity and phase count
- [ ] **P21**: Planner-to-Planner — planner can spawn sub-planners for complex goals, each handling a sub-domain

## Bugs

- [x] **PB1**: Tagged projects and attachments not passed as context — fixed: project paths and file paths now appended to messages, system prompt instructs planner to use them directly
- [ ] **PB2**: User messages don't render tags and attachments — `@project` tags show as plain text and `[Attached files: ...]` shows as a raw string. User messages should render project tags as styled chips and attachments as file chips, matching the editor's visual style.

## Design Documents

- Planner project management: `docs/plans/2026-03-23-planner-project-management-design.md`
