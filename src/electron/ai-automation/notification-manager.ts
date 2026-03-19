import { BrowserWindow, Notification } from 'electron'
import { randomUUID } from 'crypto'
import { store } from '../storage/store.js'
import { ipcWebContentsSend } from '../utils/ipc-handle.js'

let mainWindow: BrowserWindow | null = null

export function setNotificationMainWindow(window: BrowserWindow) {
  mainWindow = window
}

function getSettings() {
  return store.get('aiAutomationSettings')
}

export function sendNotification(
  type: AINotification['type'],
  taskId: string,
  taskTitle: string,
  message: string
): void {
  const settings = getSettings()

  // Check if this notification type is enabled
  if (type === 'manual_phase' && !settings.notifyOnManualPhase) return
  if (type === 'needs_attention' && !settings.notifyOnNeedsAttention) return
  if (type === 'task_done' && !settings.notifyOnTaskDone) return
  if (type === 'phase_start' && !settings.notifyOnPhaseStart) return

  const notification: AINotification = {
    id: randomUUID(),
    taskId,
    taskTitle,
    type,
    message,
    createdAt: new Date().toISOString(),
    read: false,
  }

  // Store notification (cap at 50)
  const stored = store.get('aiNotifications') as AINotification[] || []
  stored.unshift(notification)
  if (stored.length > 50) stored.length = 50
  store.set('aiNotifications', stored)

  // Push to UI
  if (mainWindow && !mainWindow.isDestroyed()) {
    ipcWebContentsSend('aiNotifications', mainWindow.webContents, stored)
  }

  // Deliver native notification if window is unfocused
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isFocused()) {
    const nativeNotif = new Notification({
      title: taskTitle,
      body: message,
    })
    nativeNotif.show()
  }
}

export function getNotifications(): AINotification[] {
  return (store.get('aiNotifications') as AINotification[]) || []
}

export function markAllRead(): void {
  const stored = (store.get('aiNotifications') as AINotification[]) || []
  const updated = stored.map(n => ({ ...n, read: true }))
  store.set('aiNotifications', updated)
  if (mainWindow && !mainWindow.isDestroyed()) {
    ipcWebContentsSend('aiNotifications', mainWindow.webContents, updated)
  }
}
