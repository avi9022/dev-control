# Phase Defaults & Settings Modal Design

## Problem
1. Request Changes hardcodes "find previous agent phase" — user can't control where rejected tasks go
2. Amendment form defaults to pipeline[0] — no configurable default
3. Settings replaces the entire kanban view instead of overlaying it

## Solution

### New settings fields
Add to `AIAutomationSettings`:
- `defaultRequestChangesPhase?: string` — phase ID
- `defaultAmendmentPhase?: string` — phase ID

### Request Changes popover
Add a phase picker Select dropdown. Defaults to `settings.defaultRequestChangesPhase` if set, otherwise falls back to nearest previous agent phase. User can override per-submission.

### AmendmentForm default
Change default from `pipeline[0]` to `settings.defaultAmendmentPhase` if set, otherwise `pipeline[0]`.

### Settings General tab
Two new Select dropdowns: "Default Request Changes Phase" and "Default Amendment Phase".

### Settings as Dialog
AIKanban renders AISettings inside a Radix Dialog. AISettings drops its back button/header and becomes dialog content. The dialog is large (max-w-4xl, tall) to fit the tabbed settings.
