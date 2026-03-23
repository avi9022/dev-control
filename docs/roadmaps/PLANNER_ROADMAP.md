# AI Task Planner — Roadmap

The planner is a conversational agent that helps users break down goals into actionable tasks. This roadmap tracks its evolution from basic task creation to full project orchestration.

## Completed

- [x] **P1**: Core Planner — conversational chat UI, Claude CLI with MCP tools, creates tasks and boards
- [x] **P2**: Knowledge Doc Access — planner reads project knowledge docs via MCP tools
- [x] **P3**: Debug Panel — expandable stream events, session IDs, auto-save conversations
- [x] **P4**: Better Task Descriptions — system prompt enforces self-contained, context-rich descriptions

- [x] **P5**: Project Creation — planner detects new project needed, asks user to confirm, opens modal (name, location, git init, board selection), project created and registered before tasks are created

- [x] **P6**: Instant First Message — greeting shown from UI immediately, agent only spawns on first user message

## Planned
- [ ] **P7**: Project Tagging in Tasks — planner assigns correct project(s) to each task via `create_task` tool, so tasks get worktrees automatically
- [ ] **P7**: Task Cross-References — planner links related tasks using `#shortId` syntax so agents can explore sibling task directories
- [ ] **P8**: Task Dependencies — planner marks task ordering (e.g., "create skeleton" blocks "add first feature") using F48 dependency system
- [ ] **P9**: Template Scaffolding — after creating a project, planner can run scaffold commands (`npm init`, `create-react-app`, etc.) via a new MCP tool
- [ ] **P10**: Pipeline Selection — planner suggests which pipeline phases each task should go through based on the task type (e.g., documentation tasks skip code review)
- [ ] **P11**: Conversation History — planner can resume previous planning sessions, review what was discussed, and continue from where it left off
- [ ] **P12**: Multi-Project Planning — planner can create tasks spanning multiple projects in a single session (e.g., API + frontend + shared library)
- [ ] **P13**: Markdown Message Rendering — render planner assistant messages as parsed markdown instead of plain text, with proper headings, bold, lists, code blocks, and links for a polished chat experience

## Backlog

- [ ] **P14**: Cost Estimation — planner estimates token/cost usage for the planned tasks based on description complexity and phase count
- [ ] **P15**: Planner-to-Planner — planner can spawn sub-planners for complex goals, each handling a sub-domain

## Design Documents

- Planner project management: `docs/plans/2026-03-23-planner-project-management-design.md`
