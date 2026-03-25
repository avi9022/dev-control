# Project Knowledge System — Design

## Overview

Give the planner agent structured knowledge about projects so it can make informed decisions about which projects are relevant to a user's goal, without loading everything upfront.

## Two-Tier Knowledge

### Tier 1: Project Profile (always in system prompt)

Small, fixed-structure summary per project. Injected into the planner's system prompt dynamically. The planner always sees ALL profiles — no tool call needed.

**Structure:**

```
Name: web-phoenix-journey
Path: /Users/avi/.../web-phoenix-journey
Summary: WhatsApp deposit onboarding flow for Phoenix insurance. Handles customer registration, OTP verification, and open banking consent.
Stack: React 19, TypeScript, Vite, MUI
Responsibilities: Customer-facing UI for the WhatsApp deposit journey. Handles OTP screens, open banking consent flow, and returning customer detection. Touch this project when changing anything the end user sees in the deposit onboarding.
```

**Fields:**
- **Name** — project label (from directory name or package.json)
- **Path** — directory path
- **Summary** — 1-2 sentences: what it IS and what it DOES
- **Stack** — tech/tools/frameworks (empty for non-code projects)
- **Responsibilities** — what it OWNS and WHEN to involve it

~200-300 tokens per project. 20 projects = ~5000 tokens in the system prompt.

### Tier 2: Detailed Knowledge (on demand via MCP tool)

Full structured documentation per project. The planner loads this only for projects it decides are relevant.

**Structure:**

```markdown
# Project: web-phoenix-journey

## Architecture
App structure, routes, pages, key directories, how the app is organized.

## Key Files
Entry points, config files, main modules, where important logic lives.

## API / Integrations
External services it talks to, internal APIs it exposes, endpoints.

## Data Flow
How data moves through the app, state management approach.

## Development
How to run locally, environment variables, build/test commands.
```

~2000-5000 tokens per project. Fixed section headers, content varies per project. Non-code projects may have empty sections.

## Storage

Both tiers stored in DevControl's user data directory (alongside existing knowledge docs). NOT inside project repos.

```
{userData}/project-knowledge/
  {project-id}/
    profile.json       # Tier 1 (structured fields)
    knowledge.md       # Tier 2 (full markdown doc)
```

Project ID derived from the directory path (base64 encoded, same as DirectorySettings.id).

## Generation

An agent scans the project and generates both tiers:
- Reads package.json, README, key config files, directory structure
- Produces the profile (Tier 1) and detailed knowledge (Tier 2)
- User can re-generate or manually edit either tier

Generation triggered:
- Manually from the UI (per project)
- Optionally on project registration (auto-generate profile at minimum)

## Access

### Tier 1 — System Prompt Injection

The planner's system prompt is built dynamically. After the static instructions, inject a "Known Projects" section:

```
## Known Projects

### web-phoenix-journey
- Path: /Users/avi/.../web-phoenix-journey
- Summary: WhatsApp deposit onboarding flow...
- Stack: React 19, TypeScript, Vite, MUI
- Responsibilities: Customer-facing UI...

### service-loan-journey-v3
- Path: /Users/avi/.../service-loan-journey-v3
- Summary: NestJS backend for loan journey...
- Stack: NestJS, TypeScript, BigQuery
- Responsibilities: All loan journey API endpoints...
```

The planner always has this context. No tool call needed.

### Tier 2 — MCP Tool

New tool: `get_project_knowledge`

Input: `{ projectPath: string }`
Output: The full Tier 2 markdown document

The planner calls this when it needs deeper understanding of a specific project.

## System Prompt Changes

Update `planner-prompt.ts`:
- Step 2 (Gather Context): "Review the Known Projects section below. If you need deeper knowledge about a specific project, use `get_project_knowledge`."
- Remove the instruction to call `list_projects` (profiles are already in the prompt)
- Keep `list_projects` as a tool for the planner to refresh the list (in case projects changed during the conversation)

## Implementation Tasks

1. Define profile and knowledge types
2. Create storage manager (save/load/delete profiles and knowledge docs)
3. Create generation agent (scans project, produces both tiers)
4. New MCP tool: `get_project_knowledge`
5. Modify planner prompt builder to inject Tier 1 profiles
6. UI: project settings page to view/edit/regenerate profiles and knowledge
7. Update planner system prompt instructions
