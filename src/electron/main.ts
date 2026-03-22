import { app, BrowserWindow, Tray, Menu, globalShortcut, nativeImage, screen, shell } from 'electron'
import { isDev } from './utils/is-dev.js'
import { getPreloadPath, getUIPath, getOverlayUIPath, getAssetsPath } from './pathResolver.js'
import path from 'path'
import { ipcMainHandle, ipcWebContentsSend } from './utils/ipc-handle.js'
import { store } from './storage/store.js'
import { addDirectoriesFromFolder } from './functions/add-directories-from-folder.js'
import { updateDirectoryData } from './functions/update-directory-data.js'
import { runService, stopProcess, stopAllProcesses } from './functions/run-service.js'
import { isServiceRunning } from './functions/is-service-running.js'
import { pollPorts } from './functions/poll-ports.js'
import { removeDirectory } from './functions/remove-directory.js'
import { openProjectInBrowser } from './functions/open-project-in-browser.js'
import { spawnShell, writeShell, resizeShell, killShell, killAllShells, setShellMainWindow } from './shell/shell-manager.js'
import { getServiceQueues } from './functions/get-service-queues.js'
import { brokerManager } from './brokers/index.js'
import { createWorkflow } from './functions/create-workflow.js'
import { removeWorkflow } from './functions/remove-workflow.js'
import { updateWorkflow } from './functions/update-workflow.js'
import { getWorkflowById } from './storage/get-workflow-by-id.js'
import { workflowExecutor } from './workflows/workflow-executor.js'
import { migrateWorkflows } from './workflows/workflow-migration.js'
import { openInIDE, getAvailableIDEs } from './functions/open-in-ide.js'
// import { pollUpdates } from './functions/poll-updates.js'
import { markUserAsPrompted } from './functions/markUserAsPrompted.js'
import { refuseUpdates } from './functions/refuse-updates.js'
import { updateSystem } from './functions/update-system.js'
import { readLogFile, clearLogFile, ensureLogsDirectory, readLogFileChunk, readLogFileTail, getLogFileLineCount, searchLogFile, readLogFileRange } from './utils/log-file-manager.js'
import { getTodosForDate, saveTodosForDate, getTodoFolderPath, setTodoFolderPath, getAvailableDates, ensureTodoFolder } from './storage/todos.js'
import { getImportantValues, saveImportantValues } from './storage/important-values.js'
import type { Todo } from './storage/todos.js'
import fs from 'fs'
import { dynamoDBManager } from './dynamodb/dynamodb-manager.js'
import { listTables } from './dynamodb/list-tables.js'
import { describeTable } from './dynamodb/describe-table.js'
import { scanTable } from './dynamodb/scan-table.js'
import { queryTable, type QueryOptions } from './dynamodb/query-table.js'
import { putItem } from './dynamodb/put-item.js'
import { deleteItem } from './dynamodb/delete-item.js'
import { getItem } from './dynamodb/get-item.js'
// API Client
import { apiClientManager } from './api-client/api-client-manager.js'
import { executeRequest, cancelActiveRequest } from './api-client/request-executor.js'
import { importPostmanCollection, importPostmanEnvironment, importPostmanCollectionFromPath } from './api-client/postman-importer.js'
import { exportPostmanCollection } from './api-client/postman-exporter.js'
// Docker
import { dockerManager } from './docker/docker-manager.js'
// SQL Developer
import { sqlManager } from './sql/sql-manager.js'
import { executeQuery as sqlExecQuery, executeScript as sqlExecScript, cancelQuery as sqlCancel, explainPlan as sqlExplain, enableDbmsOutput as sqlEnableDbms, getDbmsOutput as sqlGetDbms } from './sql/query-executor.js'
import { getSchemas as sqlGetSchemas, getTables as sqlGetTables, getViews as sqlGetViews, getSequences as sqlGetSequences, getProcedures as sqlGetProcedures, getFunctions as sqlGetFunctions, getPackages as sqlGetPackages, getTriggers as sqlGetTriggers, getTableColumns as sqlGetColumns, getTableConstraints as sqlGetConstraints, getTableIndexes as sqlGetIndexes, getTableTriggers as sqlGetTableTriggers, getObjectDDL as sqlGetDDL, getTableRowCount as sqlGetRowCount, describeObject as sqlDescribeObject, getTableGrants as sqlGetGrants, getSchemaColumnMap as sqlGetSchemaColumnMap } from './sql/schema-inspector.js'
// MongoDB
import { mongoManager } from './mongodb/mongo-manager.js'
// AI Automation
import { getTasks, getTaskById, createTask as aiCreateTask, updateTask as aiUpdateTask, deleteTask as aiDeleteTask, moveTaskPhase, getSettings as getAISettings, updateSettings as updateAISettings, setTaskManagerMainWindow, migrateSettings, migrateExistingTasks, migrateTaskWorkspaces, recoverStaleTasks, migrateToBoards, getBoardPipeline } from './ai-automation/task-manager.js'
import { stopAgent, sendInput, enqueueTask, setAgentMainWindow, stopAllAgents, getTaskOutputHistory, getAgentStats } from './ai-automation/agent-runner.js'
import { getDiff as getAITaskDiff, cleanupWorktree } from './ai-automation/worktree-manager.js'
import { startMcpServer, stopMcpServer } from './ai-automation/mcp-server.js'
import { listTaskDirFiles, readTaskDirFile, attachFiles, deleteAttachment, deleteAgentFile, listAttachments, getOrCreateTaskDir } from './ai-automation/task-dir-manager.js'
import { generateKnowledgeDoc } from './ai-automation/knowledge-generator.js'
import { getBranchInfo, renameBranch, editCommitMessage, editMultipleCommitMessages, squashCommits } from './ai-automation/git-operations.js'
import { setNotificationMainWindow, getNotifications, markAllRead } from './ai-automation/notification-manager.js'
import { sendPlannerMessage, setPlannerMainWindow } from './ai-automation/planner-runner.js'
import { savePlannerConversation } from './ai-automation/mcp-tools/save-planner-conversation.js'
import { randomUUID } from 'crypto'
import { getDatabases, createDatabase, dropDatabase } from './mongodb/database-operations.js'
import { getCollections, createCollection as mongoCreateCol, dropCollection, renameCollection, getCollectionStats } from './mongodb/collection-operations.js'
import { findDocuments, findDocumentById, insertDocument, updateDocument, deleteDocument as mongoDeleteDoc, insertMany, deleteMany } from './mongodb/document-operations.js'
import { explainQuery, runAggregation } from './mongodb/query-executor.js'
import { getIndexes, createIndex, dropIndex } from './mongodb/index-operations.js'
import { analyzeSchema } from './mongodb/schema-analyzer.js'

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
  // pollUpdates()

  // Setup tray (overlay window is created on-demand to appear on current space)
  tray = createTray()

  // Register global shortcut for overlay toggle
  const todoSettings = store.get('todoSettings')
  const initialShortcut = todoSettings?.shortcut || 'CommandOrControl+Shift+T'
  let currentShortcut = initialShortcut

  const registerOverlayShortcut = (accelerator: string) => {
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
    todoFolderWatcher = fs.watch(todoFolder, (eventType, filename) => {
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
    return store.get('todoSettings') || { autoHide: false, opacity: 10, bgColor: '#ffffff', shortcut: 'CommandOrControl+Shift+T' }
  })

  ipcMainHandle('setTodoSettings', (_event, settings: TodoSettings) => {
    const prev = store.get('todoSettings')
    store.set('todoSettings', settings)
    if (settings.shortcut && settings.shortcut !== prev?.shortcut) {
      registerOverlayShortcut(settings.shortcut)
    }
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

  // Important Values IPC handlers
  ipcMainHandle('getImportantValues', async () => {
    return await getImportantValues()
  })

  ipcMainHandle('saveImportantValues', async (_event, values: ImportantValue[]) => {
    await saveImportantValues(values)
  })

  ipcMainHandle('pollQueue', (_event, queueUrl: string) => {
    if (queuePollIntervals.has(queueUrl)) {
      clearInterval(queuePollIntervals.get(queueUrl)!);
    }

    const getData = async () => {
      const data = await brokerManager.getQueueData(queueUrl);
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
  ipcMainHandle('openExternalUrl', (_event, url: string) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
    }
  })
  // Shell (interactive terminal)
  ipcMainHandle('shellSpawn', (_event, cwd: string) => spawnShell(cwd))
  ipcMainHandle('shellWrite', (_event, shellId: string, data: string) => writeShell(shellId, data))
  ipcMainHandle('shellResize', (_event, shellId: string, cols: number, rows: number) => resizeShell(shellId, cols, rows))
  ipcMainHandle('shellKill', (_event, shellId: string) => killShell(shellId))

  ipcMainHandle('openInIDE', (_event, id: string, cliCommand: string) => openInIDE(id, cliCommand))
  ipcMainHandle('getAvailableIDEs', () => getAvailableIDEs())
  ipcMainHandle('openInFinder', (_event, filePath: string) => shell.showItemInFolder(filePath))
  ipcMainHandle('getQueues', (_event, id: string) => getServiceQueues(id))
  ipcMainHandle('sendQueueMessage', (_event, queueUrl: string, message: string) => brokerManager.sendMessage(queueUrl, message))
  ipcMainHandle('createQueue', (_event, name: string, options: CreateQueueOptions) => brokerManager.createQueue(name, options))
  ipcMainHandle('deleteQueue', (_event, queueUrl: string) => brokerManager.deleteQueue(queueUrl))
  ipcMainHandle('purgeQueue', (_event, queueUrl: string) => brokerManager.purgeQueue(queueUrl))
  ipcMainHandle('purgeAllQueues', () => brokerManager.purgeAllQueues())
  ipcMainHandle('getQueueData', (_event, queueUrl: string) => brokerManager.getQueueData(queueUrl))

  // Broker handlers
  ipcMainHandle('getBrokerConfigs', () => brokerManager.getBrokerConfigs())
  ipcMainHandle('saveBrokerConfig', (_event, config: BrokerConfig) => brokerManager.saveBrokerConfig(config))
  ipcMainHandle('getActiveBroker', () => brokerManager.getActiveBrokerType())
  ipcMainHandle('setActiveBroker', (_event, type: BrokerType) => brokerManager.setActiveBroker(type))
  ipcMainHandle('testBrokerConnection', (_event, type: BrokerType) => brokerManager.testConnection(type))

  // Workflows
  ipcMainHandle('createWorkflow', (_event, data: Omit<EnhancedWorkflow, 'id' | 'createdAt' | 'updatedAt'>) => createWorkflow(data))
  ipcMainHandle('removeWorkflow', (_event, id: string) => removeWorkflow(id))
  ipcMainHandle('updateWorkflow', (_event, id: string, data: Omit<EnhancedWorkflow, 'id' | 'createdAt' | 'updatedAt'>) => updateWorkflow(id, data))
  ipcMainHandle('startWorkflow', (_event, id: string) => workflowExecutor.startWorkflow(id))
  ipcMainHandle('stopWorkflow', (_event, id: string) => workflowExecutor.stopWorkflow(id))
  ipcMainHandle('cancelWorkflow', (_event, id: string) => workflowExecutor.cancelWorkflow(id))
  ipcMainHandle('duplicateWorkflow', (_event, id: string) => {
    const workflow = getWorkflowById(id)
    if (!workflow) throw new Error('Workflow not found')
    createWorkflow({ name: `${workflow.name} (copy)`, startSteps: workflow.startSteps, stopSteps: workflow.stopSteps })
  })
  ipcMainHandle('getWorkflowExecutionHistory', (_event, id: string) => workflowExecutor.getExecutionHistory(id))

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

  // DynamoDB connection handlers
  ipcMainHandle('getDynamoDBConnections', () => dynamoDBManager.getConnections())
  ipcMainHandle('saveDynamoDBConnection', (_event, config: DynamoDBConnectionConfig) => dynamoDBManager.saveConnection(config))
  ipcMainHandle('deleteDynamoDBConnection', (_event, id: string) => dynamoDBManager.deleteConnection(id))
  ipcMainHandle('getActiveDynamoDBConnection', () => dynamoDBManager.getActiveConnectionId())
  ipcMainHandle('setActiveDynamoDBConnection', (_event, id: string) => dynamoDBManager.setActiveConnection(id))
  ipcMainHandle('testDynamoDBConnection', (_event, id: string) => dynamoDBManager.testConnection(id))

  // DynamoDB handlers
  ipcMainHandle('dynamodbListTables', async () => {
    return await listTables()
  })
  ipcMainHandle('dynamodbDescribeTable', async (_event, tableName: string) => {
    return await describeTable(tableName)
  })
  ipcMainHandle('dynamodbScanTable', async (_event, tableName: string, options: DynamoDBScanOptions) => {
    return await scanTable(tableName, options)
  })
  ipcMainHandle('dynamodbQueryTable', async (_event, tableName: string, options: QueryOptions) => {
    return await queryTable(tableName, options)
  })
  ipcMainHandle('dynamodbGetItem', async (_event, tableName: string, key: Record<string, unknown>) => {
    return await getItem(tableName, key)
  })
  ipcMainHandle('dynamodbPutItem', async (_event, tableName: string, item: Record<string, unknown>) => {
    return await putItem(tableName, item)
  })
  ipcMainHandle('dynamodbDeleteItem', async (_event, tableName: string, key: Record<string, unknown>) => {
    return await deleteItem(tableName, key)
  })

  // ─── API Client handlers ───
  apiClientManager.setMainWindow(mainWindow)

  ipcMainHandle('apiGetWorkspaces', () => apiClientManager.getWorkspaces())
  ipcMainHandle('apiCreateWorkspace', (_event, name: string) => apiClientManager.createWorkspace(name))
  ipcMainHandle('apiDeleteWorkspace', (_event, id: string) => apiClientManager.deleteWorkspace(id))
  ipcMainHandle('apiSetActiveWorkspace', (_event, id: string) => apiClientManager.setActiveWorkspace(id))
  ipcMainHandle('apiGetActiveWorkspaceId', () => store.get('activeApiWorkspaceId') ?? null)
  ipcMainHandle('apiImportPostmanCollection', async (_event, workspaceId: string) => {
    const collections = await importPostmanCollection()
    for (const collection of collections) {
      apiClientManager.addCollectionToWorkspace(workspaceId, collection)
    }
    return collections
  })
  ipcMainHandle('apiImportPostmanEnvironment', async (_event, workspaceId: string) => {
    const environments = await importPostmanEnvironment()
    for (const env of environments) {
      apiClientManager.addEnvironmentToWorkspace(workspaceId, env)
    }
    return environments
  })
  ipcMainHandle('apiCreateCollection', (_event, workspaceId: string, name: string) => apiClientManager.createCollection(workspaceId, name))
  ipcMainHandle('apiDeleteCollection', (_event, workspaceId: string, collectionId: string) => apiClientManager.deleteCollection(workspaceId, collectionId))
  ipcMainHandle('apiUpdateCollection', (_event, workspaceId: string, collectionId: string, data: Partial<ApiCollection>) => apiClientManager.updateCollection(workspaceId, collectionId, data))
  ipcMainHandle('apiReorderCollection', (_event, workspaceId: string, collectionId: string, targetCollectionId: string | null, position: 'before' | 'after') => apiClientManager.reorderCollection(workspaceId, collectionId, targetCollectionId, position))
  ipcMainHandle('apiAddRequest', (_event, workspaceId: string, collectionId: string, parentFolderId: string | null, config: ApiRequestConfig) => apiClientManager.addRequest(workspaceId, collectionId, parentFolderId, config))
  ipcMainHandle('apiAddFolder', (_event, workspaceId: string, collectionId: string, parentFolderId: string | null, name: string) => apiClientManager.addFolder(workspaceId, collectionId, parentFolderId, name))
  ipcMainHandle('apiUpdateRequest', (_event, workspaceId: string, collectionId: string, itemId: string, config: ApiRequestConfig) => apiClientManager.updateRequest(workspaceId, collectionId, itemId, config))
  ipcMainHandle('apiRenameItem', (_event, workspaceId: string, collectionId: string, itemId: string, name: string) => apiClientManager.renameItem(workspaceId, collectionId, itemId, name))
  ipcMainHandle('apiDuplicateItem', (_event, workspaceId: string, collectionId: string, itemId: string) => apiClientManager.duplicateItem(workspaceId, collectionId, itemId))
  ipcMainHandle('apiDeleteItem', (_event, workspaceId: string, collectionId: string, itemId: string) => apiClientManager.deleteItem(workspaceId, collectionId, itemId))
  ipcMainHandle('apiMoveItem', (_event, workspaceId: string, sourceCollectionId: string, itemId: string, targetCollectionId: string, targetId: string | null, position: 'before' | 'after' | 'inside') => apiClientManager.moveItem(workspaceId, sourceCollectionId, itemId, targetCollectionId, targetId, position))
  ipcMainHandle('apiUpdateFolderAuth', (_event, workspaceId: string, collectionId: string, folderId: string, auth: ApiAuth) => apiClientManager.updateFolderAuth(workspaceId, collectionId, folderId, auth))
  ipcMainHandle('apiUpdateCollectionAuth', (_event, workspaceId: string, collectionId: string, auth: ApiAuth) => apiClientManager.updateCollectionAuth(workspaceId, collectionId, auth))
  ipcMainHandle('apiGetResolvedAuth', (_event, workspaceId: string, collectionId: string, requestId: string) => apiClientManager.getResolvedAuth(workspaceId, collectionId, requestId))
  ipcMainHandle('apiGetEnvironments', (_event, workspaceId: string) => apiClientManager.getEnvironments(workspaceId))
  ipcMainHandle('apiCreateEnvironment', (_event, workspaceId: string, name: string) => apiClientManager.createEnvironment(workspaceId, name))
  ipcMainHandle('apiUpdateEnvironment', (_event, workspaceId: string, envId: string, env: ApiEnvironment) => apiClientManager.updateEnvironment(workspaceId, envId, env))
  ipcMainHandle('apiDeleteEnvironment', (_event, workspaceId: string, envId: string) => apiClientManager.deleteEnvironment(workspaceId, envId))
  ipcMainHandle('apiSetActiveEnvironment', (_event, workspaceId: string, envId: string | null) => apiClientManager.setActiveEnvironment(workspaceId, envId))
  ipcMainHandle('apiSendRequest', async (_event, workspaceId: string, config: ApiRequestConfig, requestId?: string, collectionId?: string) => {
    // Resolve inherited auth if type is 'inherit'
    let finalConfig = config
    if (config.auth?.type === 'inherit' && requestId && collectionId) {
      const resolvedAuthInfo = apiClientManager.getResolvedAuth(workspaceId, collectionId, requestId)
      if (resolvedAuthInfo) {
        finalConfig = { ...config, auth: resolvedAuthInfo.auth }
      }
    }
    const response = await executeRequest(workspaceId, finalConfig)
    apiClientManager.addHistory(workspaceId, config, response)
    return response
  })
  ipcMainHandle('apiCancelRequest', () => cancelActiveRequest())
  ipcMainHandle('apiGetHistory', (_event, workspaceId: string) => apiClientManager.getHistory(workspaceId))
  ipcMainHandle('apiClearHistory', (_event, workspaceId: string) => apiClientManager.clearHistory(workspaceId))
  ipcMainHandle('apiImportPostmanCollectionFromPath', async (_event, workspaceId: string, filePath: string) => {
    const collection = await importPostmanCollectionFromPath(filePath)
    apiClientManager.addCollectionToWorkspace(workspaceId, collection)
    return collection
  })
  ipcMainHandle('apiExportPostmanCollection', (_event, workspaceId: string, collectionId: string) => {
    const workspaces = apiClientManager.getWorkspaces()
    const workspace = workspaces.find((w) => w.id === workspaceId)
    const collection = workspace?.collections.find((c) => c.id === collectionId)
    if (!collection) throw new Error('Collection not found')
    return exportPostmanCollection(collection)
  })

  // ─── Docker handlers ───
  dockerManager.setMainWindow(mainWindow)
  dockerManager.startPolling()

  ipcMainHandle('dockerGetContexts', () => dockerManager.getContexts())
  ipcMainHandle('dockerSwitchContext', (_event, name: string) => dockerManager.switchContext(name))
  ipcMainHandle('dockerGetActiveContext', () => dockerManager.getActiveContext())
  ipcMainHandle('dockerIsAvailable', () => dockerManager.isAvailable())
  ipcMainHandle('dockerGetContainers', (_event, filters?: DockerContainerFilters) => dockerManager.getContainers(filters))
  ipcMainHandle('dockerGetContainer', (_event, id: string, dockerContext?: string) => dockerManager.getContainer(id, dockerContext))
  ipcMainHandle('dockerStartContainer', (_event, id: string, dockerContext?: string) => dockerManager.startContainer(id, dockerContext))
  ipcMainHandle('dockerStopContainer', (_event, id: string, dockerContext?: string) => dockerManager.stopContainer(id, dockerContext))
  ipcMainHandle('dockerRestartContainer', (_event, id: string, dockerContext?: string) => dockerManager.restartContainer(id, dockerContext))
  ipcMainHandle('dockerPauseContainer', (_event, id: string, dockerContext?: string) => dockerManager.pauseContainer(id, dockerContext))
  ipcMainHandle('dockerUnpauseContainer', (_event, id: string, dockerContext?: string) => dockerManager.unpauseContainer(id, dockerContext))
  ipcMainHandle('dockerRemoveContainer', (_event, id: string, force: boolean, dockerContext?: string) => dockerManager.removeContainer(id, force, dockerContext))
  ipcMainHandle('dockerExecInContainer', (_event, id: string, command: string[], dockerContext?: string) => dockerManager.execInContainer(id, command, dockerContext))
  // Interactive Exec
  ipcMainHandle('dockerExecInteractive', (_event, containerId: string, shell: string, dockerContext?: string) => dockerManager.startInteractiveExec(containerId, shell, dockerContext))
  ipcMainHandle('dockerExecInput', (_event, sessionId: string, data: string) => dockerManager.writeToExecSession(sessionId, data))
  ipcMainHandle('dockerExecResize', (_event, sessionId: string, cols: number, rows: number) => dockerManager.resizeExecSession(sessionId, cols, rows))
  ipcMainHandle('dockerExecClose', (_event, sessionId: string) => dockerManager.closeExecSession(sessionId))
  // File Manager
  ipcMainHandle('dockerListDirectory', (_event, containerId: string, path: string, dockerContext?: string) => dockerManager.listDirectory(containerId, path, dockerContext))
  ipcMainHandle('dockerReadFile', (_event, containerId: string, path: string, maxSize?: number, dockerContext?: string) => dockerManager.readFile(containerId, path, maxSize, dockerContext))
  ipcMainHandle('dockerDownloadFile', (_event, containerId: string, remotePath: string, isDirectory?: boolean, dockerContext?: string) => dockerManager.downloadFile(containerId, remotePath, isDirectory, dockerContext))
  ipcMainHandle('dockerUploadFile', (_event, containerId: string, localPath: string, remotePath: string, dockerContext?: string) => dockerManager.uploadFile(containerId, localPath, remotePath, dockerContext))
  ipcMainHandle('dockerUploadFiles', (_event, containerId: string, localPaths: string[], remotePath: string, dockerContext?: string) => dockerManager.uploadFiles(containerId, localPaths, remotePath, dockerContext))
  ipcMainHandle('dockerUploadFileDialog', (_event, containerId: string, remotePath: string, dockerContext?: string) => dockerManager.uploadFileDialog(containerId, remotePath, dockerContext))
  ipcMainHandle('dockerCreateDirectory', (_event, containerId: string, path: string, dockerContext?: string) => dockerManager.createDirectory(containerId, path, dockerContext))
  ipcMainHandle('dockerDeletePath', (_event, containerId: string, path: string, recursive?: boolean, dockerContext?: string) => dockerManager.deletePath(containerId, path, recursive, dockerContext))
  ipcMainHandle('dockerRenamePath', (_event, containerId: string, oldPath: string, newPath: string, dockerContext?: string) => dockerManager.renamePath(containerId, oldPath, newPath, dockerContext))
  ipcMainHandle('dockerStartDrag', (_event, containerId: string, remotePath: string, dockerContext?: string) => dockerManager.startDrag(containerId, remotePath, dockerContext))
  ipcMainHandle('dockerInspectContainer', (_event, id: string, dockerContext?: string) => dockerManager.inspectContainer(id, dockerContext))
  ipcMainHandle('dockerGetContainerLogs', (_event, id: string, options: DockerLogOptions, dockerContext?: string) => dockerManager.getContainerLogs(id, options, dockerContext))
  ipcMainHandle('dockerStreamContainerLogs', (_event, id: string, options: DockerLogOptions, dockerContext?: string) => dockerManager.streamContainerLogs(id, options, dockerContext))
  ipcMainHandle('dockerStopLogStream', (_event, id: string) => dockerManager.stopLogStream(id))
  ipcMainHandle('dockerGetContainerStats', (_event, id: string, dockerContext?: string) => dockerManager.getContainerStats(id, dockerContext))
  ipcMainHandle('dockerGetAllStats', () => dockerManager.getAllStats())
  ipcMainHandle('dockerGetImages', () => dockerManager.getImages())
  ipcMainHandle('dockerPullImage', (_event, name: string) => dockerManager.pullImage(name))
  ipcMainHandle('dockerRemoveImage', (_event, id: string, force: boolean, dockerContext?: string) => dockerManager.removeImage(id, force, dockerContext))
  ipcMainHandle('dockerInspectImage', (_event, id: string) => dockerManager.inspectImage(id))
  ipcMainHandle('dockerGetImageHistory', (_event, id: string) => dockerManager.getImageHistory(id))
  ipcMainHandle('dockerPruneImages', (_event, danglingOnly: boolean) => dockerManager.pruneImages(danglingOnly))
  ipcMainHandle('dockerGetVolumes', () => dockerManager.getVolumes())
  ipcMainHandle('dockerCreateVolume', (_event, name: string, labels?: Record<string, string>) => dockerManager.createVolume(name, labels))
  ipcMainHandle('dockerRemoveVolume', (_event, name: string, dockerContext?: string) => dockerManager.removeVolume(name, dockerContext))
  ipcMainHandle('dockerPruneVolumes', () => dockerManager.pruneVolumes())
  ipcMainHandle('dockerGetNetworks', () => dockerManager.getNetworks())
  ipcMainHandle('dockerCreateNetwork', (_event, name: string, driver: string) => dockerManager.createNetwork(name, driver))
  ipcMainHandle('dockerRemoveNetwork', (_event, id: string, dockerContext?: string) => dockerManager.removeNetwork(id, dockerContext))
  ipcMainHandle('dockerInspectNetwork', (_event, id: string) => dockerManager.inspectNetwork(id))
  ipcMainHandle('dockerGetComposeProjects', () => dockerManager.getComposeProjects())
  ipcMainHandle('dockerComposeUp', (_event, project: string) => dockerManager.composeUp(project))
  ipcMainHandle('dockerComposeDown', (_event, project: string) => dockerManager.composeDown(project))
  ipcMainHandle('dockerComposeRestart', (_event, project: string) => dockerManager.composeRestart(project))
  ipcMainHandle('dockerGetDashboardStats', () => dockerManager.getDashboardStats())
  ipcMainHandle('dockerGetSystemInfo', () => dockerManager.getSystemInfo())
  ipcMainHandle('dockerSystemPrune', (_event, includeVolumes: boolean) => dockerManager.systemPrune(includeVolumes))

  // ─── SQL Developer handlers ───
  sqlManager.setMainWindow(mainWindow)
  ipcMainHandle('sqlGetConnections', () => sqlManager.getConnections())
  ipcMainHandle('sqlSaveConnection', (_event, config: SQLConnectionConfig) => sqlManager.saveConnection(config))
  ipcMainHandle('sqlDeleteConnection', (_event, id: string) => sqlManager.deleteConnection(id))
  ipcMainHandle('sqlTestConnection', (_event, id: string) => sqlManager.testConnection(id))
  ipcMainHandle('sqlSetActiveConnection', (_event, id: string) => sqlManager.setActiveConnection(id))
  ipcMainHandle('sqlDisconnect', () => sqlManager.disconnect())
  ipcMainHandle('sqlGetActiveConnectionId', () => sqlManager.getActiveConnectionId())
  ipcMainHandle('sqlExecuteQuery', async (_event, sql: string, params?: unknown[]) => {
    try {
      return await sqlExecQuery(sql, params)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Query execution failed', { cause: err })
    }
  })
  ipcMainHandle('sqlExecuteScript', async (_event, sql: string) => {
    try {
      return await sqlExecScript(sql)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Script execution failed', { cause: err })
    }
  })
  ipcMainHandle('sqlCancelQuery', (_event, queryId: string) => sqlCancel(queryId))
  ipcMainHandle('sqlExplainPlan', async (_event, sql: string) => {
    try {
      return await sqlExplain(sql)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Explain plan failed', { cause: err })
    }
  })
  ipcMainHandle('sqlEnableDbmsOutput', () => sqlEnableDbms())
  ipcMainHandle('sqlGetDbmsOutput', () => sqlGetDbms())
  ipcMainHandle('sqlGetSchemas', (_event, includeSystem?: boolean) => sqlGetSchemas(includeSystem))
  ipcMainHandle('sqlGetTables', (_event, schema: string) => sqlGetTables(schema))
  ipcMainHandle('sqlGetViews', (_event, schema: string) => sqlGetViews(schema))
  ipcMainHandle('sqlGetSequences', (_event, schema: string) => sqlGetSequences(schema))
  ipcMainHandle('sqlGetProcedures', (_event, schema: string) => sqlGetProcedures(schema))
  ipcMainHandle('sqlGetFunctions', (_event, schema: string) => sqlGetFunctions(schema))
  ipcMainHandle('sqlGetPackages', (_event, schema: string) => sqlGetPackages(schema))
  ipcMainHandle('sqlGetTriggers', (_event, schema: string) => sqlGetTriggers(schema))
  ipcMainHandle('sqlGetTableColumns', (_event, schema: string, table: string) => sqlGetColumns(schema, table))
  ipcMainHandle('sqlGetTableConstraints', (_event, schema: string, table: string) => sqlGetConstraints(schema, table))
  ipcMainHandle('sqlGetTableIndexes', (_event, schema: string, table: string) => sqlGetIndexes(schema, table))
  ipcMainHandle('sqlGetTableTriggers', (_event, schema: string, table: string) => sqlGetTableTriggers(schema, table))
  ipcMainHandle('sqlGetObjectDDL', (_event, schema: string, objectName: string, objectType: string) => sqlGetDDL(schema, objectName, objectType))
  ipcMainHandle('sqlGetTableRowCount', (_event, schema: string, table: string) => sqlGetRowCount(schema, table))
  ipcMainHandle('sqlDescribeObject', (_event, schema: string, name: string) => sqlDescribeObject(schema, name))
  ipcMainHandle('sqlGetTableGrants', (_event, schema: string, table: string) => sqlGetGrants(schema, table))
  ipcMainHandle('sqlGetSchemaColumnMap', (_event, schema: string) => sqlGetSchemaColumnMap(schema))
  ipcMainHandle('sqlGetHistory', () => (store.get('sqlHistory') as SQLHistoryEntry[] | undefined) ?? [])
  ipcMainHandle('sqlClearHistory', () => store.set('sqlHistory', []))
  ipcMainHandle('sqlGetSavedQueries', () => (store.get('sqlSavedQueries') as SQLSavedQuery[] | undefined) ?? [])
  ipcMainHandle('sqlSaveQuery', (_event, query: SQLSavedQuery) => {
    const queries = (store.get('sqlSavedQueries') as SQLSavedQuery[] | undefined) ?? []
    const idx = queries.findIndex((q) => q.id === query.id)
    if (idx >= 0) {
      const updated = [...queries]
      updated[idx] = query
      store.set('sqlSavedQueries', updated)
    } else {
      store.set('sqlSavedQueries', [...queries, query])
    }
  })
  ipcMainHandle('sqlDeleteSavedQuery', (_event, id: string) => {
    const queries = (store.get('sqlSavedQueries') as SQLSavedQuery[] | undefined) ?? []
    store.set('sqlSavedQueries', queries.filter((q) => q.id !== id))
  })

  // ─── MongoDB handlers ───
  mongoManager.setMainWindow(mainWindow)
  mongoManager.autoReconnect()

  ipcMainHandle('mongoGetConnections', () => mongoManager.getConnections())
  ipcMainHandle('mongoGetActiveConnectionId', () => mongoManager.getActiveConnectionId())
  ipcMainHandle('mongoSaveConnection', (_event, config: MongoConnectionConfig) => mongoManager.saveConnection(config))
  ipcMainHandle('mongoDeleteConnection', (_event, id: string) => mongoManager.deleteConnection(id))
  ipcMainHandle('mongoTestConnection', (_event, id: string) => mongoManager.testConnection(id))
  ipcMainHandle('mongoSetActiveConnection', (_event, id: string) => mongoManager.setActiveConnection(id))
  ipcMainHandle('mongoDisconnect', () => mongoManager.disconnect())
  ipcMainHandle('mongoGetDatabases', async () => getDatabases())
  ipcMainHandle('mongoCreateDatabase', async (_event, dbName: string, collectionName: string) => createDatabase(dbName, collectionName))
  ipcMainHandle('mongoDropDatabase', async (_event, dbName: string) => dropDatabase(dbName))
  ipcMainHandle('mongoGetCollections', async (_event, database: string) => getCollections(database))
  ipcMainHandle('mongoCreateCollection', async (_event, database: string, name: string) => mongoCreateCol(database, name))
  ipcMainHandle('mongoDropCollection', async (_event, database: string, name: string) => dropCollection(database, name))
  ipcMainHandle('mongoRenameCollection', async (_event, database: string, oldName: string, newName: string) => renameCollection(database, oldName, newName))
  ipcMainHandle('mongoGetCollectionStats', async (_event, database: string, collection: string) => getCollectionStats(database, collection))
  ipcMainHandle('mongoFindDocuments', async (_event, database: string, collection: string, options: MongoQueryOptions) => findDocuments(database, collection, options))
  ipcMainHandle('mongoFindDocumentById', async (_event, database: string, collection: string, id: string) => findDocumentById(database, collection, id))
  ipcMainHandle('mongoInsertDocument', async (_event, database: string, collection: string, document: Record<string, unknown>) => insertDocument(database, collection, document))
  ipcMainHandle('mongoUpdateDocument', async (_event, database: string, collection: string, id: string, update: Record<string, unknown>) => updateDocument(database, collection, id, update))
  ipcMainHandle('mongoDeleteDocument', async (_event, database: string, collection: string, id: string) => mongoDeleteDoc(database, collection, id))
  ipcMainHandle('mongoInsertMany', async (_event, database: string, collection: string, documents: Record<string, unknown>[]) => insertMany(database, collection, documents))
  ipcMainHandle('mongoDeleteMany', async (_event, database: string, collection: string, filter: Record<string, unknown>) => deleteMany(database, collection, filter))
  ipcMainHandle('mongoExplainQuery', async (_event, database: string, collection: string, options: MongoQueryOptions) => explainQuery(database, collection, options))
  ipcMainHandle('mongoRunAggregation', async (_event, database: string, collection: string, pipeline: MongoAggregationStage[]) => runAggregation(database, collection, pipeline))
  ipcMainHandle('mongoAnalyzeSchema', async (_event, database: string, collection: string, sampleSize?: number) => analyzeSchema(database, collection, sampleSize))
  ipcMainHandle('mongoGetIndexes', async (_event, database: string, collection: string) => getIndexes(database, collection))
  ipcMainHandle('mongoCreateIndex', async (_event, database: string, collection: string, options: MongoCreateIndexOptions) => createIndex(database, collection, options))
  ipcMainHandle('mongoDropIndex', async (_event, database: string, collection: string, indexName: string) => dropIndex(database, collection, indexName))
  ipcMainHandle('mongoGetValidationRules', async () => null)
  ipcMainHandle('mongoSetValidationRules', async () => { })
  ipcMainHandle('mongoExportCollection', async () => { })
  ipcMainHandle('mongoImportDocuments', async () => 0)
  ipcMainHandle('mongoGetSavedQueries', () => store.get('mongoSavedQueries'))
  ipcMainHandle('mongoSaveQuery', (_event, query: MongoSavedQuery) => {
    const queries = store.get('mongoSavedQueries')
    const existing = queries.findIndex(q => q.id === query.id)
    if (existing >= 0) {
      store.set('mongoSavedQueries', queries.map((q, i) => i === existing ? query : q))
    } else {
      store.set('mongoSavedQueries', [...queries, query])
    }
  })
  ipcMainHandle('mongoDeleteSavedQuery', (_event, id: string) => {
    store.set('mongoSavedQueries', store.get('mongoSavedQueries').filter(q => q.id !== id))
  })

  // ─── AI Automation handlers ───
  ipcMainHandle('aiGetTasks', async () => {
    return getTasks()
  })

  ipcMainHandle('aiCreateTask', async (_event, title, description, projects, boardId) => {
    return aiCreateTask(title, description, projects, boardId)
  })

  ipcMainHandle('aiSelectDirectory', async () => {
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Worktree Directory'
    })
    if (!result.canceled && result.filePaths[0]) {
      return result.filePaths[0]
    }
    return null
  })

  ipcMainHandle('aiUpdateTask', async (_event, id, updates) => {
    aiUpdateTask(id, updates)
  })

  ipcMainHandle('aiDeleteTask', async (_event, id) => {
    // Clean up any temporary worktree services
    const directories = store.get('directories') as DirectorySettings[]
    const prefix = `wt-${id}-`
    const toRemove = directories.filter(d => d.id.startsWith(prefix))
    for (const dir of toRemove) {
      try { stopProcess(dir.id) } catch { /* not running */ }
    }
    if (toRemove.length > 0) {
      store.set('directories', directories.filter(d => !d.id.startsWith(prefix)))
    }
    aiDeleteTask(id)
  })

  ipcMainHandle('aiMoveTaskPhase', async (_event, id, targetPhase) => {
    moveTaskPhase(id, targetPhase)
    if (targetPhase !== 'BACKLOG' && targetPhase !== 'DONE') {
      const task = getTaskById(id)
      const pipeline = task ? getBoardPipeline(task.boardId) : []
      const phaseConfig = pipeline.find(p => p.id === targetPhase)
      if (phaseConfig?.type === 'agent') {
        enqueueTask(id)
      }
    }
  })

  ipcMainHandle('aiStopTask', async (_event, id) => {
    await stopAgent(id)
  })

  ipcMainHandle('aiSendTaskInput', async (_event, taskId, input) => {
    sendInput(taskId, input)
  })

  ipcMainHandle('aiGetTaskOutputHistory', async (_event, taskId) => {
    return getTaskOutputHistory(taskId)
  })

  ipcMainHandle('aiReadContextHistory', async (_event, contextHistoryPath: string) => {
    let prompt = ''
    let events = '[]'
    try { prompt = fs.readFileSync(path.join(contextHistoryPath, 'prompt.md'), 'utf-8') } catch { /* */ }
    try { events = fs.readFileSync(path.join(contextHistoryPath, 'events.json'), 'utf-8') } catch { /* */ }
    return { prompt, events }
  })

  ipcMainHandle('aiGetAgentStats', async (_event, taskId) => {
    return getAgentStats(taskId)
  })

  ipcMainHandle('aiGetNotifications', async () => {
    return getNotifications()
  })

  ipcMainHandle('aiMarkNotificationsRead', async () => {
    markAllRead()
  })

  ipcMainHandle('aiGetTaskDiff', async (_event, taskId) => {
    const task = getTasks().find(t => t.id === taskId)
    if (!task) return []

    const results: AIProjectDiff[] = []

    // Collect diffs from all worktrees
    for (const wt of (task.worktrees || [])) {
      try {
        const project = task.projects?.find(p => p.path === wt.projectPath)
        const diff = getAITaskDiff(wt.worktreePath, wt.branchName, project?.baseBranch)
        if (diff) {
          results.push({
            project: project?.label || wt.projectPath.split('/').pop() || wt.projectPath,
            path: wt.projectPath,
            diff
          })
        }
      } catch {
        // Skip failed diffs
      }
    }

    // Fallback: if no worktrees, try first project
    if (results.length === 0 && task.projects?.length > 0) {
      try {
        const diff = getAITaskDiff(task.projects[0].path)
        if (diff) {
          results.push({
            project: task.projects[0].label,
            path: task.projects[0].path,
            diff
          })
        }
      } catch {
        // Skip
      }
    }

    return results
  })

  ipcMainHandle('aiOpenTaskDir', async (_event, taskId) => {
    const taskDir = getOrCreateTaskDir(taskId)
    shell.openPath(taskDir)
  })

  ipcMainHandle('aiCreateTaskServices', async (_event, taskId) => {
    const task = getTasks().find(t => t.id === taskId)
    if (!task?.worktrees?.length) return []

    // Clean up any stale entries from previous runs first
    const prefix = `wt-${taskId}-`
    const directories = (store.get('directories') as DirectorySettings[]).filter(d => !d.id.startsWith(prefix))
    const created: DirectorySettings[] = []

    for (const wt of task.worktrees) {
      // Use the last path segment as unique suffix (project folder name)
      const projectSlug = wt.projectPath.split('/').pop() || 'unknown'
      const tempId = `wt-${taskId}-${projectSlug}`

      // Find original directory config by project path
      const original = directories.find(d => d.path === wt.projectPath)
      const label = task.projects?.find(p => p.path === wt.projectPath)?.label || projectSlug

      // If no node_modules in worktree, prepend npm install
      let runCommand = original?.runCommand
      if (runCommand && !fs.existsSync(path.join(wt.worktreePath, 'node_modules'))) {
        runCommand = `npm install -f && ${runCommand}`
      }

      const tempDir: DirectorySettings = {
        id: tempId,
        path: wt.worktreePath,
        name: label,
        customLabel: `${label} (worktree)`,
        runCommand,
        port: original?.port,
        packageJsonExists: original?.packageJsonExists ?? true,
        isFrontendProj: original?.isFrontendProj ?? false,
      }
      directories.push(tempDir)
      created.push(tempDir)
    }

    store.set('directories', directories)
    return created
  })

  ipcMainHandle('aiCleanupTaskServices', async (_event, taskId) => {
    const directories = store.get('directories') as DirectorySettings[]
    const prefix = `wt-${taskId}-`
    const toRemove = directories.filter(d => d.id.startsWith(prefix))

    // Stop any running processes
    for (const dir of toRemove) {
      try { stopProcess(dir.id) } catch { /* not running */ }
    }

    const remaining = directories.filter(d => !d.id.startsWith(prefix))
    store.set('directories', remaining)
  })

  ipcMainHandle('aiRemoveWorktree', async (_event, taskId) => {
    const task = getTasks().find(t => t.id === taskId)
    if (!task?.worktrees?.length) return
    for (const wt of task.worktrees) {
      cleanupWorktree(wt.projectPath, wt.worktreePath)
    }
    aiUpdateTask(taskId, { worktrees: [] })
  })

  ipcMainHandle('aiAttachTaskFiles', async (_event, taskId, filePaths) => {
    return attachFiles(taskId, filePaths)
  })

  ipcMainHandle('aiDeleteTaskAttachment', async (_event, taskId, filename) => {
    deleteAttachment(taskId, filename)
  })

  ipcMainHandle('aiDeleteAgentFile', async (_event, taskId, filename) => {
    deleteAgentFile(taskId, filename)
  })

  ipcMainHandle('aiToggleFileExclusion', async (_event, taskId, filename) => {
    const task = getTasks().find(t => t.id === taskId)
    if (!task) return
    const excluded = task.excludedFiles || []
    const isExcluded = excluded.includes(filename)
    const updated = isExcluded ? excluded.filter(f => f !== filename) : [...excluded, filename]
    aiUpdateTask(taskId, { excludedFiles: updated })
  })

  ipcMainHandle('aiListTaskAttachments', async (_event, taskId) => {
    return listAttachments(taskId)
  })

  ipcMainHandle('aiSelectFiles', async () => {
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      title: 'Select Files to Attach'
    })
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths
    }
    return null
  })

  ipcMainHandle('aiGetTaskFiles', async (_event, taskId) => {
    return listTaskDirFiles(taskId)
  })

  ipcMainHandle('aiReadTaskFile', async (_event, taskId, filename) => {
    return readTaskDirFile(taskId, filename)
  })

  ipcMainHandle('aiSendPlannerMessage', async (_event, conversation: { role: string; content: string }[], cwd: string) => {
    return sendPlannerMessage(conversation as { role: 'user' | 'assistant'; content: string }[], cwd)
  })

  ipcMainHandle('aiSavePlannerConversation', async (_event, sessionId: string, messages: { role: string; content: string }[], debugEvents: unknown[]) => {
    return savePlannerConversation(sessionId, messages, debugEvents)
  })

  ipcMainHandle('aiGetSettings', async () => {
    return getAISettings()
  })

  ipcMainHandle('aiUpdateSettings', async (_event, updates) => {
    updateAISettings(updates)
  })

  ipcMainHandle('aiGenerateKnowledgeDoc', async (_event, projectPath) => {
    const settings = getAISettings()
    const now = new Date().toISOString()
    const projectName = projectPath.split('/').pop() || 'Unknown Project'
    const existingIndex = settings.knowledgeDocs.findIndex(d => d.sourcePath === projectPath)

    // Create or update the doc immediately with generating status
    const docId = existingIndex >= 0 ? settings.knowledgeDocs[existingIndex].id : randomUUID()
    const placeholderDoc: AIKnowledgeDoc = {
      id: docId,
      title: projectName,
      content: existingIndex >= 0 ? settings.knowledgeDocs[existingIndex].content : '',
      sourcePath: projectPath,
      generatingStatus: 'Starting...',
      createdAt: existingIndex >= 0 ? settings.knowledgeDocs[existingIndex].createdAt : now,
      updatedAt: now,
      autoGenerated: true
    }

    const initialDocs = [...settings.knowledgeDocs]
    if (existingIndex >= 0) {
      initialDocs[existingIndex] = placeholderDoc
    } else {
      initialDocs.push(placeholderDoc)
    }
    updateAISettings({ knowledgeDocs: initialDocs })

    // Helper to update the doc's generating status
    const updateDocStatus = (status: string) => {
      const current = getAISettings()
      const docs = current.knowledgeDocs.map(d =>
        d.id === docId ? { ...d, generatingStatus: status || undefined } : d
      )
      updateAISettings({ knowledgeDocs: docs })
    }

    try {
      const content = await generateKnowledgeDoc(projectPath, updateDocStatus)

      // Final update: set content, clear generating status
      const current = getAISettings()
      const docs = current.knowledgeDocs.map(d =>
        d.id === docId ? { ...d, content, generatingStatus: undefined, updatedAt: new Date().toISOString() } : d
      )
      updateAISettings({ knowledgeDocs: docs })
      return docs.find(d => d.id === docId)!
    } catch (err) {
      // Mark as failed
      const current = getAISettings()
      const docs = current.knowledgeDocs.map(d =>
        d.id === docId ? { ...d, generatingStatus: `Failed: ${(err as Error).message}` } : d
      )
      updateAISettings({ knowledgeDocs: docs })
      throw err
    }
  })

  // Git operations
  ipcMainHandle('aiGetBranchInfo', async (_event, taskId) => {
    return getBranchInfo(taskId)
  })

  ipcMainHandle('aiRenameBranch', async (_event, taskId, worktreePath, newBranchName, pushToRemote) => {
    renameBranch(taskId, worktreePath, newBranchName, pushToRemote)
  })

  ipcMainHandle('aiEditCommitMessage', async (_event, worktreePath, commitHash, newMessage, pushToRemote) => {
    editCommitMessage(worktreePath, commitHash, newMessage, pushToRemote)
  })

  ipcMainHandle('aiEditMultipleCommitMessages', async (_event, worktreePath, edits, pushToRemote) => {
    editMultipleCommitMessages(worktreePath, edits, pushToRemote)
  })

  ipcMainHandle('aiSquashCommits', async (_event, worktreePath, baseBranch, newMessage, pushToRemote) => {
    squashCommits(worktreePath, baseBranch, newMessage, pushToRemote)
  })

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