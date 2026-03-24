# DevControl General — Roadmap

General system-wide bugs and features that don't belong to a specific feature area.

## Bugs

- [ ] **GB1**: JSON Diff tool broken — the JSON Diff developer tool is not functioning correctly, needs investigation and fix
- [ ] **GB2**: Preload/Window type mismatch — the Window interface in types/ipc.d.ts and the actual preload.cts implementation are not validated against each other. Methods declared in the Window interface may not exist at runtime. Need to restructure so TypeScript catches mismatches at compile time.

## Planned Features

## Backlog
