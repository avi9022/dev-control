# F42: 3D Task Visualization — Roadmap

## Overview

A Minecraft-style 3D voxel world that visualizes AI tasks and agents. Built incrementally, starting from the most basic 3D rendering and adding complexity over time.

**Tech Stack:** React Three Fiber (`@react-three/fiber`), Drei helpers (`@react-three/drei`)

---

## Phase 1: Basic 3D World

- [x] **F42.1**: Install dependencies — `@react-three/fiber`, `@react-three/drei`, `three`
- [x] **F42.2**: Toggle button — 3D view toggle in top bar, only visible on kanban view
- [x] **F42.3**: Empty canvas — `<Canvas>` with perspective camera (diorama angle)
- [x] **F42.4**: Sky — Drei `<Sky>` component with atmospheric fog
- [x] **F42.5**: Terrain — large flat green plane (200x200) with fog hiding edges
- [x] **F42.6**: Lighting — ambient + directional light, warm tone

## Phase 2: Zones & Layout

- [x] **F42.7**: Zone buildings — each pipeline phase is a building with colored walls, door, stepped roof
- [x] **F42.8**: Sign posts — wooden sign with phase name at each building
- [x] **F42.9**: Paths — winding dirt paths connecting buildings in pipeline order
- [x] **F42.10**: Village layout — collision-free scattered placement with minimum spacing

## Phase 3: Task Characters

- [x] **F42.11**: Task cubes — blocky humanoid (body + head) standing near their zone's building
- [x] **F42.12**: Task colors — green/bobbing when running, red when needs attention, gray when idle
- [x] **F42.13**: Task labels — floating name text above each character
- [x] **F42.14**: Task interaction — click a character to open task detail
- [x] **F42.15**: Walking animation — smooth walk with step-bounce between zones on phase change

## Phase 4: Better Characters

- [ ] **F42.16**: Humanoid model — arms, legs, distinct body parts instead of cube+head
- [ ] **F42.17**: Agent type visuals — different colors/accessories per role (planner, worker, reviewer)
- [ ] **F42.18**: Working animation — agent stands next to building, hammering/reading/inspecting
- [ ] **F42.19**: Pathfinding — characters navigate around buildings instead of walking through walls

## Phase 5: Better Structures

- [ ] **F42.20**: Structure variety — a set of pre-built building designs (cottage, tower, workshop, tent, etc.) randomly assigned to phases
- [ ] **F42.21**: Structure theming — buildings visually match their phase role (planning = library/tent, implementation = workshop, review = watchtower)

## Phase 6: World Decoration

- [ ] **F42.22**: Trees — scattered voxel trees around the village
- [ ] **F42.23**: Fences & props — fences around buildings, barrels, crates, lanterns
- [ ] **F42.24**: Water — small pond or stream near the village

## Phase 7: Polish & Interactivity

- [ ] **F42.25**: Day/night cycle — tie to dark/light theme (dark = night with moonlight)
- [ ] **F42.26**: 3D task detail panel — floating panel in the 3D world showing task info, so user stays in 3D view
- [ ] **F42.27**: Task grouping — when too many tasks in one zone, show them as a clustered group with a count badge, expand on click
- [ ] **F42.28**: Particle effects — sparkles on active agents, smoke on errors
- [ ] **F42.29**: Transition animation — smooth camera fly-in when entering 3D view
- [ ] **F42.30**: Sound effects — optional ambient sounds, click sounds

## Known Bugs

- [ ] **B-3D-1**: Characters walk through buildings when switching phases — road network routes don't fully avoid building footprints
- [ ] **B-3D-2**: Internal work spot paths not refined enough — some paths still clip corners of buildings
- [ ] **B-3D-3**: Some work spots are positioned inside building blocks — need to verify all spots are outside walls
- [ ] **B-3D-4**: Multiple characters at the same work spot overlap — need to offset characters when sharing a spot or assign different spots per character

---

## Architecture

```
world3d/
├── types.ts          # Zone, Task3D interfaces, constants
├── utils.ts          # hash(), getZonePositions()
├── Terrain.tsx       # Green ground plane
├── ZoneBuilding.tsx  # Building structure per zone
├── SignPost.tsx       # Wooden sign with label
├── Path.tsx          # Dirt path between zones
├── TaskCube.tsx      # Task character with walk animation
├── Zones.tsx         # Composes buildings + signs + paths + tasks
└── Scene.tsx         # Lighting, sky, fog, controls, terrain, zones
```

## Notes

- Each sub-task is intentionally small and self-contained
- Can stop at any phase and it's still a usable feature
- Zones = buildings (static), Tasks = characters (move between zones)
- Task cubes rendered in flat list (not nested in zone groups) to preserve React component identity across phase changes, enabling walk animation
