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
import { sendSqsMessage } from './functions/send-queue-message.js'
import { purgeQueue } from './functions/purge-queue.js'
import { getQueueData } from './functions/get-queue-data.js'
import { pollQueues } from './functions/poll-queues.js'

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

  ipcMainHandle('getDirectories', () => {
    const directories = store.get('directories')
    return directories
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
  ipcMainHandle('purgeQueue', (_event, queueUrl: string) => purgeQueue(queueUrl))
  ipcMainHandle('getQueueData', (_event, queueUrl: string) => getQueueData(queueUrl))

  store.onDidChange('directories', (newVal) => {
    ipcWebContentsSend('directories', mainWindow.webContents, newVal || []);
  });
})