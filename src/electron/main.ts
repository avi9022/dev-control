import { app, BrowserWindow, Tray, Menu, globalShortcut, nativeImage, screen } from 'electron'
import { isDev } from './utils/is-dev.js'
import { getPreloadPath, getUIPath, getOverlayUIPath } from './pathResolver.js'
import { ipcMainHandle, ipcWebContentsSend } from './utils/ipc-handle.js'
import { store } from './storage/store.js'
import { addDirectoriesFromFolder } from './functions/add-directories-from-folder.js'
import { updateDirectoryData } from './functions/update-directory-data.js'
import { runService, stopProcess } from './functions/run-service.js'
import { isServiceRunning } from './functions/is-service-running.js'
import { pollPorts } from './functions/poll-ports.js'
import { removeDirectory } from './functions/remove-directory.js'
import { openProjectInBrowser } from './functions/open-project-in-browser.js'
import { getServiceQueues } from './functions/get-service-queues.js'
import { sendSqsMessage } from './sqs/send-queue-message.js'
import { purgeQueue } from './sqs/purge-queue.js'
import { getQueueData } from './functions/get-queue-data.js'
import { pollQueues } from './functions/poll-queues.js'
import { deleteQueue } from './sqs/delete-queue.js'
import { createQueue } from './sqs/create-queue.js'
import { createWorkflow } from './functions/create-workflow.js'
import { removeWorkflow } from './functions/remove-workflow.js'
import { updateWorkflow } from './functions/update-workflow.js'
import { startWorkflow } from './functions/start-workflow.js'
import { openInVSCode } from './functions/open-in-vscode.js'
import { pollUpdates } from './functions/poll-updates.js'
import { markUserAsPrompted } from './functions/markUserAsPrompted.js'
import { refuseUpdates } from './functions/refuse-updates.js'
import { updateSystem } from './functions/update-system.js'
import { readLogFile, clearLogFile, ensureLogsDirectory, readLogFileChunk, readLogFileTail, getLogFileLineCount, searchLogFile, readLogFileRange } from './utils/log-file-manager.js'
import { getTodosForDate, saveTodosForDate, getTodoFolderPath, setTodoFolderPath, getAvailableDates, ensureTodoFolder } from './storage/todos.js'
import type { Todo } from './storage/todos.js'
import fs from 'fs'

const queuePollIntervals = new Map<string, NodeJS.Timeout>();

let tray: Tray | null = null
let overlayWindow: BrowserWindow | null = null

const createTrayIcon = (): Electron.NativeImage => {
  // Create a simple checkmark icon for the tray (16x16 for macOS menu bar)
  // Using a template image for proper dark/light mode support
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADGSURBVDiNpdMxTsNAEIXhf8YOdJQICUQ6CgoEHYfgAFwiN0jHCTgBR+AEdEhIlJQ0QDqKSGwwBckijz3sNLOa3W/fzswKM6OJlBr1rkZEDALUNvMJuI8IC2BtZq8Rwao0sxMR+aiqW2AdEe6A88g5ExHZm9kj8AB8VNUbEXFcq9ozc6iqFyLyBFxHxFNV3RGRFxHxUlXXw+IvcAvcmdkOuBeRFxFZVdV9Lx76pS9m9g6cVdV17WvPzM4ioh8R1ar6U6bN7C8A/AFU7V1mAntL8gAAAABJRU5ErkJggg=='
  )
  icon.setTemplateImage(true)
  return icon
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
    // macOS: use panel type to stay on current space
    type: process.platform === 'darwin' ? 'panel' : undefined,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      preload: getPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // Set to appear on all workspaces and stay on top
  if (process.platform === 'darwin') {
    overlayWindow.setAlwaysOnTop(true, 'pop-up-menu')
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  } else {
    overlayWindow.setAlwaysOnTop(true)
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

  pollPorts(mainWindow)
  pollQueues(mainWindow)
  pollUpdates()

  // Setup tray (overlay window is created on-demand to appear on current space)
  tray = createTray()

  // Register global shortcut (Cmd+Shift+T on macOS, Ctrl+Shift+T on other platforms)
  const shortcut = process.platform === 'darwin' ? 'Command+Shift+T' : 'Ctrl+Shift+T'
  const registered = globalShortcut.register(shortcut, () => {
    toggleOverlay()
  })

  if (!registered) {
    console.warn('Failed to register global shortcut for Todo Widget')
  }

  // Watch todos folder for external file changes
  const todoFolder = getTodoFolderPath()
  let debounceTimer: NodeJS.Timeout | null = null
  ensureTodoFolder().then(() => {
    fs.watch(todoFolder, (eventType, filename) => {
      if (filename?.startsWith('TODOS-') && filename.endsWith('.json')) {
        // Debounce to avoid multiple rapid events
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          const date = filename.replace('TODOS-', '').replace('.json', '')
          if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.webContents.send('todosFileChanged', { date })
          }
        }, 100)
      }
    })
  })

  // Todo IPC handlers
  ipcMainHandle('getTodosForDate', async (_event, date: string) => {
    return await getTodosForDate(date)
  })

  ipcMainHandle('saveTodosForDate', async (_event, date: string, todos: Todo[]) => {
    await saveTodosForDate(date, todos)
  })

  ipcMainHandle('getTodoFolderPath', () => {
    return getTodoFolderPath()
  })

  ipcMainHandle('setTodoFolderPath', (_event, folderPath: string) => {
    setTodoFolderPath(folderPath)
  })

  ipcMainHandle('getAvailableDates', async () => {
    return await getAvailableDates()
  })

  ipcMainHandle('getTodoSettings', () => {
    return store.get('todoSettings') || { autoHide: false }
  })

  ipcMainHandle('setTodoSettings', (_event, settings: { autoHide: boolean }) => {
    store.set('todoSettings', settings)
  })

  ipcMainHandle('hideOverlay', () => {
    hideOverlay()
  })

  ipcMainHandle('selectTodoFolder', async () => {
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Todo Folder'
    })
    if (!result.canceled && result.filePaths[0]) {
      setTodoFolderPath(result.filePaths[0])
      return result.filePaths[0]
    }
    return null
  })

  ipcMainHandle('pollQueue', (_event, queueUrl: string) => {
    if (queuePollIntervals.has(queueUrl)) {
      clearInterval(queuePollIntervals.get(queueUrl)!);
    }

    const getData = async () => {
      const data = await getQueueData(queueUrl);
      ipcWebContentsSend('queueData', mainWindow.webContents, { queueUrl, data });
    }
    getData()
    const interval = setInterval(async () => {
      await getData()
    }, 5000);

    queuePollIntervals.set(queueUrl, interval);
    return true;
  });

  ipcMainHandle('stopPollingQueue', (_event, queueUrl: string) => {
    if (queuePollIntervals.has(queueUrl)) {
      clearInterval(queuePollIntervals.get(queueUrl)!);
      queuePollIntervals.delete(queueUrl);
    }
    return true;
  });

  ipcMainHandle('getDirectories', () => {
    const directories = store.get('directories')
    return directories
  })
  ipcMainHandle('getWorkflows', () => {
    const flows = store.get('workflows')
    return flows
  })
  ipcMainHandle('addDirectoriesFromFolder', () => addDirectoriesFromFolder())
  ipcMainHandle('removeDirectory', async (_event, id: string | undefined) => {
    await removeDirectory(id)
  })
  ipcMainHandle('updateDirectory', (_event, id: string, data: DataToUpdate) => updateDirectoryData(id, data))
  ipcMainHandle('runService', (_event, id: string) => runService(id, mainWindow))
  ipcMainHandle('stopService', (_event, id: string) => stopProcess(id))
  ipcMainHandle('checkServiceState', (_event, id: string) => isServiceRunning(id))
  ipcMainHandle('openProjectInBrowser', (_event, id: string) => openProjectInBrowser(id))
  ipcMainHandle('openInVSCode', (_event, id: string) => openInVSCode(id))
  ipcMainHandle('getQueues', (_event, id: string) => getServiceQueues(id))
  ipcMainHandle('sendQueueMessage', (_event, queueUrl: string, message: string) => sendSqsMessage(queueUrl, message))
  ipcMainHandle('createQueue', (_event, name: string, options: CreateQueueOptions) => createQueue(name, options))
  ipcMainHandle('deleteQueue', (_event, queueUrl: string) => deleteQueue(queueUrl))
  ipcMainHandle('purgeQueue', (_event, queueUrl: string) => purgeQueue(queueUrl))
  ipcMainHandle('getQueueData', (_event, queueUrl: string) => getQueueData(queueUrl))

  // Workflows
  ipcMainHandle('createWorkflow', (_event, name: string, services: string[]) => createWorkflow(name, services))
  ipcMainHandle('removeWorkflow', (_event, id: string) => removeWorkflow(id))
  ipcMainHandle('updateWorkflow', (_event, id: string, data: Omit<Workflow, 'id'>) => updateWorkflow(id, data))
  ipcMainHandle('startWorkflow', (_event, id: string) => startWorkflow(id, mainWindow))

  // Update notification settings
  ipcMainHandle('markUserAsPrompted', () => markUserAsPrompted())
  ipcMainHandle('refuseUpdates', () => refuseUpdates())
  ipcMainHandle('updateSystem', () => updateSystem())

  // Log file operations
  ipcMainHandle('getLogs', async (_event, dirId: string) => {
    return await readLogFile(dirId)
  })
  ipcMainHandle('clearLogs', async (_event, dirId: string) => {
    try {
      await clearLogFile(dirId)
      return true
    } catch (error) {
      console.error('Failed to clear logs:', error)
      return false
    }
  })
  
  // Pagination and search operations
  ipcMainHandle('getLogsChunk', async (_event, dirId: string, offset: number, limit: number) => {
    return await readLogFileChunk(dirId, offset, limit)
  })
  ipcMainHandle('getLogsTail', async (_event, dirId: string, limit: number) => {
    return await readLogFileTail(dirId, limit)
  })
  ipcMainHandle('getLogFileLineCount', async (_event, dirId: string) => {
    return await getLogFileLineCount(dirId)
  })
  ipcMainHandle('searchLogs', async (_event, dirId: string, searchTerm: string) => {
    return await searchLogFile(dirId, searchTerm)
  })
  ipcMainHandle('getLogsRange', async (_event, dirId: string, startLine: number, endLine: number) => {
    return await readLogFileRange(dirId, startLine, endLine)
  })


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

// Cleanup global shortcuts when app quits
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

// Keep app running when all windows are closed (tray remains active)
app.on('window-all-closed', () => {
  // On macOS, keep running in tray
  if (process.platform !== 'darwin') {
    app.quit()
  }
})