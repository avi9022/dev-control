# F8: Notifications — Design

## Goal

Alert users when important agent events occur via macOS native notifications (when app is unfocused) or toasts (when focused), with an in-app notification history panel.

## Events

Configurable in settings (all boolean toggles):
- **Manual phase reached** (default: on) — agent finished, waiting for human review
- **Needs attention** (default: on) — crashed, stalled, error
- **Task done** (default: on) — task moved to DONE
- **Phase started** (default: off) — agent began a new phase

## Delivery

- **App focused** → Sonner toast (already in app)
- **App unfocused** → macOS native `Notification` via Electron

## Data Model

```typescript
interface AINotification {
  id: string
  taskId: string
  taskTitle: string
  type: 'manual_phase' | 'needs_attention' | 'task_done' | 'phase_start'
  message: string
  createdAt: string
  read: boolean
}
```

Settings additions:
```typescript
notifyOnManualPhase: boolean    // default true
notifyOnNeedsAttention: boolean // default true
notifyOnTaskDone: boolean       // default true
notifyOnPhaseStart: boolean     // default false
```

Stored in electron-store as array, capped at 50.

## IPC

- `aiNotifications` — push channel
- `aiGetNotifications` — load stored list
- `aiMarkNotificationsRead` — mark all read

## UI

- Bell icon in kanban header (next to settings gear)
- Unread count badge on bell
- Click opens popover with last 20 notifications
- Each notification shows: type icon, message, time ago, click navigates to task
- "Mark all read" button at top

## Files

| File | Change |
|------|--------|
| `types.d.ts` | AINotification, settings fields, IPC channels, window.electron methods |
| `src/electron/storage/store.ts` | Default settings, notification storage |
| `src/electron/ai-automation/notification-manager.ts` | New — send notifications, store, cap at 50 |
| `src/electron/main.ts` | IPC handlers, wire notification calls |
| `src/electron/preload.cts` | New methods |
| `src/electron/ai-automation/agent-runner.ts` | Emit notifications on events |
| `src/electron/ai-automation/task-manager.ts` | Emit on phase transitions |
| `src/ui/components/ai-automation/NotificationBell.tsx` | New — bell icon + popover |
| `src/ui/views/AIKanban.tsx` | Add NotificationBell to header |
| `src/ui/views/AISettings.tsx` | Notification toggles in General tab |
