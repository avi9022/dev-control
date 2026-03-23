import { app, BrowserWindow, Tray, Menu, globalShortcut, nativeImage, screen } from 'electron'
import { isDev } from './utils/is-dev.js'
import { getPreloadPath, getUIPath, getOverlayUIPath, getAssetsPath } from './pathResolver.js'
import path from 'path'
import { ipcWebContentsSend } from './utils/ipc-handle.js'
import { store } from './storage/store.js'
import { stopAllProcesses } from './functions/run-service.js'
import { pollPorts } from './functions/poll-ports.js'
import { killAllShells, setShellMainWindow } from './shell/shell-manager.js'
import { brokerManager } from './brokers/index.js'
import { migrateWorkflows } from './workflows/workflow-migration.js'
import { workflowExecutor } from './workflows/workflow-executor.js'
import { ensureLogsDirectory } from './utils/log-file-manager.js'
import { getTodoFolderPath, ensureTodoFolder } from './storage/todos.js'
import fs from 'fs'
import { dynamoDBManager } from './dynamodb/dynamodb-manager.js'
// Docker
import { dockerManager } from './docker/docker-manager.js'
// AI Automation
import { migrateSettings, migrateExistingTasks, migrateTaskWorkspaces, recoverStaleTasks, migrateToBoards, setTaskManagerMainWindow } from './ai-automation/task-manager.js'
import { setAgentMainWindow, stopAllAgents } from './ai-automation/agent-runner.js'
import { startMcpServer, stopMcpServer } from './ai-automation/mcp-server.js'
import { setNotificationMainWindow } from './ai-automation/notification-manager.js'
import { setPlannerMainWindow, killAllPlannerProcesses } from './ai-automation/planner-runner.js'
// MongoDB
import { mongoManager } from './mongodb/mongo-manager.js'
// Handler registrations
import { registerSQLHandlers } from './handlers/sql-handlers.js'
import { registerMongoDBHandlers } from './handlers/mongodb-handlers.js'
import { registerDockerHandlers } from './handlers/docker-handlers.js'
import { registerApiClientHandlers } from './handlers/api-client-handlers.js'
import { registerServiceHandlers } from './handlers/service-handlers.js'
import { registerAIHandlers } from './handlers/ai-handlers.js'
import { registerMiscHandlers } from './handlers/misc-handlers.js'

// Force X11 on Linux so globalShortcut works when app is not focused.
// Wayland blocks apps from grabbing global keyboard shortcuts.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('ozone-platform-hint', 'x11')
}

const queuePollIntervals = new Map<string, NodeJS.Timeout>();

let tray: Tray | null = null
let overlayWindow: BrowserWindow | null = null

// Track intervals and watchers for cleanup
let portPollingInterval: NodeJS.Timeout | null = null
let queuePollingInterval: NodeJS.Timeout | null = null
let todoFolderWatcher: fs.FSWatcher | null = null

const createTrayIcon = (): Electron.NativeImage => {
  try {
    const iconPath = path.join(getAssetsPath(), 'trayTemplate.png')
    const icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) {
      throw new Error('Failed to load tray icon from path: ' + iconPath)
    }
    icon.setTemplateImage(true)
    return icon
  } catch (error) {
    console.error('Failed to load tray icon, using fallback:', error)
    // Fallback: create a simple 16x16 checkmark icon from base64
    const fallbackIcon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADGSURBVDiNpdMxTsNAEIXhf8YOdJQICUQ6CgoEHYfgAFwiN0jHCTgBR+AEdEhIlJQ0QDqKSGwwBckijz3sNLOa3W/fzswKM6OJlBr1rkZEDALUNvMJuI8IC2BtZq8Rwao0sxMR+aiqW2AdEe6A88g5ExHZm9kj8AB8VNUbEXFcq9ozc6iqFyLyBFxHxFNV3RGRFxHxUlXXw+IvcAvcmdkOuBeRFxFZVdV9Lx76pS9m9g6cVdV17WvPzM4ioh8R1ar6U6bN7C8A/AFU7V1mAntL8gAAAABJRU5ErkJggg=='
    )
    fallbackIcon.setTemplateImage(true)
    return fallbackIcon
  }
}

const showOverlay = () => {
  // Destroy existing window if any
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.destroy()
    overlayWindow = null
  }

  // Get position on current display
  const cursorPos = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursorPos)
  const { x, y, width } = display.workArea

  const windowWidth = 320
  const windowHeight = 450

  // Create new window on current space
  const isMac = process.platform === 'darwin'
  overlayWindow = new BrowserWindow({
    x: x + width - windowWidth - 20,
    y: y + 50,
    width: windowWidth,
    height: windowHeight,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    hasShadow: true,
    fullscreenable: false,
    type: isMac ? 'panel' : 'toolbar',
    ...(isMac && { vibrancy: 'under-window', visualEffectState: 'active' }),
    webPreferences: {
      preload: getPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // Set to appear on all workspaces and stay on top
  if (isMac) {
    overlayWindow.setAlwaysOnTop(true, 'pop-up-menu')
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  } else {
    overlayWindow.setAlwaysOnTop(true, 'pop-up-menu')
    overlayWindow.setVisibleOnAllWorkspaces(true)
  }

  const isLocal = isDev()
  if (isLocal) {
    overlayWindow.loadURL('http://localhost:5123/overlay.html')
  } else {
    overlayWindow.loadFile(getOverlayUIPath())
  }

  // Show once loaded
  overlayWindow.once('ready-to-show', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.show()
      // On Linux, re-assert always-on-top after show to ensure WM respects it
      if (!isMac) {
        overlayWindow.setAlwaysOnTop(true, 'pop-up-menu')
        overlayWindow.moveTop()
        overlayWindow.focus()
      }
    }
  })

  // Hide when loses focus (click outside) if auto-hide enabled
  overlayWindow.on('blur', () => {
    const autoHide = store.get('todoSettings')?.autoHide ?? false
    if (autoHide && overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.destroy()
      overlayWindow = null
    }
  })
}

const hideOverlay = () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.destroy()
    overlayWindow = null
  }
}

const toggleOverlay = () => {
  if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
    hideOverlay()
  } else {
    showOverlay()
  }
}

const createTray = (): Tray => {
  const trayIcon = createTrayIcon()
  const newTray = new Tray(trayIcon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Todos',
      click: () => toggleOverlay()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  newTray.setToolTip('Todo Widget')
  newTray.setContextMenu(contextMenu)

  // Click on tray icon to toggle overlay
  newTray.on('click', () => toggleOverlay())

  return newTray
}

app.on("ready", async () => {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      preload: getPreloadPath()
    }
  })
  const isLocal = isDev()
  if (isLocal) {
    mainWindow.loadURL('http://localhost:5123')
  } else {
    mainWindow.loadFile(getUIPath())
  }

  // Ensure logs directory exists
  ensureLogsDirectory()

  // Migrate legacy workflows
  migrateWorkflows()

  // Initialize workflow executor
  workflowExecutor.setMainWindow(mainWindow)

  // Initialize AI task manager
  migrateSettings()
  migrateExistingTasks()
  migrateTaskWorkspaces()
  recoverStaleTasks()
  migrateToBoards()
  setTaskManagerMainWindow(mainWindow)
  setAgentMainWindow(mainWindow)
  setNotificationMainWindow(mainWindow)
  setPlannerMainWindow(mainWindow)
  setShellMainWindow(mainWindow)

  // Start MCP server for agent tools
  startMcpServer().catch(err => console.error('[main] Failed to start MCP server:', err))

  // Initialize broker manager
  brokerManager.setMainWindow(mainWindow)
  brokerManager.testConnection()

  // Initialize DynamoDB manager
  dynamoDBManager.setMainWindow(mainWindow)
  dynamoDBManager.testConnection()

  portPollingInterval = pollPorts(mainWindow)

  // Queue polling using broker manager
  queuePollingInterval = setInterval(async () => {
    if (!brokerManager.isConnected()) return
    const queues = await brokerManager.listQueues()
    ipcWebContentsSend('queuesList', mainWindow.webContents, queues)
  }, 500)
  // Setup tray (overlay window is created on-demand to appear on current space)
  tray = createTray()

  // Register global shortcut for overlay toggle
  const todoSettings = store.get('todoSettings')
  const initialShortcut = todoSettings?.shortcut || 'CommandOrControl+Shift+T'
  let currentShortcut = initialShortcut

  const registerOverlayShortcut = (accelerator: string): boolean => {
    globalShortcut.unregister(currentShortcut)
    const registered = globalShortcut.register(accelerator, () => {
      toggleOverlay()
    })
    if (registered) {
      currentShortcut = accelerator
    } else {
      console.warn('Failed to register global shortcut:', accelerator)
      // Re-register previous shortcut as fallback
      globalShortcut.register(currentShortcut, () => {
        toggleOverlay()
      })
    }
    return registered
  }

  registerOverlayShortcut(initialShortcut)

  // Watch todos folder for external file changes
  const todoFolder = getTodoFolderPath()
  let debounceTimer: NodeJS.Timeout | null = null
  let importantValuesDebounceTimer: NodeJS.Timeout | null = null
  ensureTodoFolder().then(() => {
    todoFolderWatcher = fs.watch(todoFolder, (_eventType, filename) => {
      if (filename?.startsWith('TODOS-') && filename.endsWith('.json')) {
        // Debounce to avoid multiple rapid events
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          const date = filename.replace('TODOS-', '').replace('.json', '')
          if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.webContents.send('todosFileChanged', { date })
          }
        }, 100)
      } else if (filename === 'IMPORTANT_VALUES.json') {
        // Watch for important values file changes
        if (importantValuesDebounceTimer) clearTimeout(importantValuesDebounceTimer)
        importantValuesDebounceTimer = setTimeout(() => {
          if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.webContents.send('importantValuesFileChanged')
          }
        }, 100)
      }
    })
  })

  // ─── Register all IPC handlers by domain ───
  registerServiceHandlers(mainWindow)
  registerSQLHandlers(mainWindow)
  registerMongoDBHandlers(mainWindow)
  registerDockerHandlers(mainWindow)
  registerApiClientHandlers(mainWindow)
  registerAIHandlers()
  registerMiscHandlers(mainWindow, {
    hideOverlay,
    registerOverlayShortcut,
    overlayWindow,
    queuePollIntervals,
  })

  // ─── Store change listeners ───
  store.onDidChange('aiAutomationSettings', (newVal) => {
    if (newVal) {
      ipcWebContentsSend('aiSettings', mainWindow.webContents, newVal)
    }
  });
  store.onDidChange('directories', (newVal) => {
    ipcWebContentsSend('directories', mainWindow.webContents, newVal || []);
  });
  store.onDidChange('workflows', (newVal) => {
    ipcWebContentsSend('workflows', mainWindow.webContents, newVal || []);
  });
  store.onDidChange('updateNotificationSettings', (newVal) => {
    ipcWebContentsSend('updateNotificationSettings', mainWindow.webContents, newVal || {
      hasUpdates: false,
      userWasPrompted: false,
      userRefusedUpdates: false,
    });
  });
})

// Cleanup all resources when app quits
app.on('before-quit', async (event) => {
  // Prevent immediate quit to allow cleanup
  event.preventDefault()

  // Stop all running service processes
  await stopAllProcesses()

  // Stop all running AI agent processes
  await stopAllAgents()

  // Kill all planner processes
  killAllPlannerProcesses()

  // Kill all interactive shells
  killAllShells()

  // Clear polling intervals
  if (portPollingInterval) {
    clearInterval(portPollingInterval)
    portPollingInterval = null
  }
  if (queuePollingInterval) {
    clearInterval(queuePollingInterval)
    queuePollingInterval = null
  }

  // Clear queue polling intervals
  for (const interval of queuePollIntervals.values()) {
    clearInterval(interval)
  }
  queuePollIntervals.clear()

  // Stop MCP server
  stopMcpServer()

  // Stop Docker polling
  dockerManager.stopPolling()

  // Disconnect MongoDB
  mongoManager.disconnect()

  // Close file watcher
  if (todoFolderWatcher) {
    todoFolderWatcher.close()
    todoFolderWatcher = null
  }

  // Cancel all active workflow executions
  workflowExecutor.cancelAll()

  // Now allow the app to quit
  app.exit(0)
})

// Cleanup global shortcuts when app quits
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (tray) {
    tray.destroy()
    tray = null
  }
})

// Handle SIGTERM/SIGINT for graceful shutdown
process.on('SIGTERM', () => app.quit())
process.on('SIGINT', () => app.quit())

// Keep app running when all windows are closed (tray remains active)
app.on('window-all-closed', () => {
  // On macOS, keep running in tray
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
