import { BrowserWindow } from 'electron'
import { ipcMainHandle, ipcWebContentsSend } from '../utils/ipc-handle.js'
import { store } from '../storage/store.js'
import { getTodosForDate, saveTodosForDate, getTodoFolderPath, setTodoFolderPath, getAvailableDates } from '../storage/todos.js'
import type { Todo } from '../storage/todos.js'
import { getImportantValues, saveImportantValues } from '../storage/important-values.js'
import { getServiceQueues } from '../functions/get-service-queues.js'
import { brokerManager } from '../brokers/index.js'
import { createWorkflow } from '../functions/create-workflow.js'
import { removeWorkflow } from '../functions/remove-workflow.js'
import { updateWorkflow } from '../functions/update-workflow.js'
import { getWorkflowById } from '../storage/get-workflow-by-id.js'
import { workflowExecutor } from '../workflows/workflow-executor.js'
import { markUserAsPrompted } from '../functions/markUserAsPrompted.js'
import { refuseUpdates } from '../functions/refuse-updates.js'
import { updateSystem } from '../functions/update-system.js'

export interface MiscHandlersContext {
  hideOverlay: () => void
  registerOverlayShortcut: (accelerator: string) => boolean
  overlayWindow: BrowserWindow | null
  queuePollIntervals: Map<string, NodeJS.Timeout>
}

export function registerMiscHandlers(mainWindow: BrowserWindow, ctx: MiscHandlersContext): void {
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
      ctx.registerOverlayShortcut(settings.shortcut)
    }
  })

  ipcMainHandle('hideOverlay', () => {
    ctx.hideOverlay()
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
    if (ctx.queuePollIntervals.has(queueUrl)) {
      clearInterval(ctx.queuePollIntervals.get(queueUrl)!);
    }

    const getData = async () => {
      const data = await brokerManager.getQueueData(queueUrl);
      ipcWebContentsSend('queueData', mainWindow.webContents, { queueUrl, data });
    }
    getData()
    const interval = setInterval(async () => {
      await getData()
    }, 5000);

    ctx.queuePollIntervals.set(queueUrl, interval);
    return true;
  });

  ipcMainHandle('stopPollingQueue', (_event, queueUrl: string) => {
    if (ctx.queuePollIntervals.has(queueUrl)) {
      clearInterval(ctx.queuePollIntervals.get(queueUrl)!);
      ctx.queuePollIntervals.delete(queueUrl);
    }
    return true;
  });

  ipcMainHandle('getWorkflows', () => {
    const flows = store.get('workflows')
    return flows
  })

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
}
