# F42: 3D Task Visualization — Roadmap

## Overview

A Minecraft-style 3D voxel world that visualizes AI tasks and agents. Built incrementally, starting from the most basic 3D rendering and adding complexity over time.

**Tech Stack:** React Three Fiber (`@react-three/fiber`), Drei helpers (`@react-three/drei`)

---

## Phase 1: Basic 3D World

- [ ] **F42.1**: Install dependencies — `@react-three/fiber`, `@react-three/drei`, `three`
- [ ] **F42.2**: Toggle button — add a button in the kanban view that switches between board view and 3D view
- [ ] **F42.3**: Empty canvas — render a `<Canvas>` component with a basic perspective camera (diorama angle, looking down)
- [ ] **F42.4**: Sky — add a sky/atmosphere (gradient or Drei's `<Sky>` component)
- [ ] **F42.5**: Terrain — flat voxel-style ground plane with Minecraft-like grass texture (green top, brown sides, grid of cubes)
- [ ] **F42.6**: Lighting — ambient + directional light for soft shadows, warm tone

## Phase 2: Zones & Layout

- [ ] **F42.7**: Zone markers — divide terrain into zones based on pipeline phases (BACKLOG, planning, in-progress, review, DONE), with signs or colored ground
- [ ] **F42.8**: Zone labels — floating text labels above each zone
- [ ] **F42.9**: Paths — simple paths/roads connecting zones in pipeline order

## Phase 3: Task Representation

- [ ] **F42.10**: Task blocks — render each task as a small structure (cube/house) in its zone
- [ ] **F42.11**: Task colors — color-code structures based on task state (idle, agent running, needs attention)
- [ ] **F42.12**: Task labels — floating name labels above each structure
- [ ] **F42.13**: Task interaction — click a structure to open the task detail view

## Phase 4: Agent Characters

- [ ] **F42.14**: Block character model — simple Minecraft-style humanoid (cube head, rectangle body)
- [ ] **F42.15**: Agent types — visual distinction per role (planner, worker, reviewer) via color/accessories
- [ ] **F42.16**: Idle animation — simple breathing/bobbing loop when agent is active
- [ ] **F42.17**: Working animation — agent stands next to its task structure, hammering/reading/inspecting
- [ ] **F42.18**: Walking animation — agent moves between zones when task changes phase

## Phase 5: Polish & Interactivity

- [ ] **F42.19**: Camera controls — add orbit controls for mouse drag/zoom/pan
- [ ] **F42.20**: Day/night cycle — tie to dark/light theme
- [ ] **F42.21**: Particle effects — sparkles on active agents, smoke on errors
- [ ] **F42.22**: Sound effects — optional ambient sounds, click sounds
- [ ] **F42.23**: Transition animation — smooth camera fly-in when entering 3D view

---

## Notes

- Each sub-task is intentionally small and self-contained
- Phase 1 is the MVP — just a pretty landscape you can look at
- Real task data integration starts in Phase 3
- Agent visualization is Phase 4 — the most complex part
- Can stop at any phase and it's still a usable feature
