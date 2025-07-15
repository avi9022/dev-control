import { app, BrowserWindow } from 'electron'
import { isDev } from './utils/is-dev.js'
import { getPreloadPath, getUIPath } from './pathResolver.js'
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

const queuePollIntervals = new Map<string, NodeJS.Timeout>();


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

  pollPorts(mainWindow)
  pollQueues(mainWindow)

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
  ipcMainHandle('removeDirectory', (_event, id: string | undefined) => removeDirectory(id))
  ipcMainHandle('updateDirectory', (_event, id: string, data: DataToUpdate) => updateDirectoryData(id, data))
  ipcMainHandle('runService', (_event, id: string) => runService(id, mainWindow))
  ipcMainHandle('stopService', (_event, id: string) => stopProcess(id))
  ipcMainHandle('checkServiceState', (_event, id: string) => isServiceRunning(id))
  ipcMainHandle('openProjectInBrowser', (_event, id: string) => openProjectInBrowser(id))
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

  store.onDidChange('directories', (newVal) => {
    ipcWebContentsSend('directories', mainWindow.webContents, newVal || []);
  });
  store.onDidChange('workflows', (newVal) => {
    ipcWebContentsSend('workflows', mainWindow.webContents, newVal || []);
  });
})