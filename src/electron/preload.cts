const electron = require('electron')

electron.contextBridge.exposeInMainWorld("electron", {
  getDirectories: () => ipcInvoke("getDirectories"),
  getWorkflows: () => ipcInvoke("getWorkflows"),
  addDirectoriesFromFolder: () => ipcInvoke('addDirectoriesFromFolder'),
  checkServiceState: (id: string) => ipcInvoke('checkServiceState', id),
  subscribeDirectories: (callback) =>
    ipcOn('directories', (stats) => {
      callback(stats || []);
    }),
  subscribeWorkflows: (callback) => ipcOn('workflows', (flows) => {
    callback(flows || []);
  }),
  subscribeLogs: (callback) =>
    ipcOn('logs', (log) => {
      callback(log || []);
    }),
  subscribeDirectoriesState: (callback) =>
    ipcOn('directoriesMapByState', (stats) => {
      callback(stats || []);
    }),
  subscribeQueuesList: (callback) =>
    ipcOn('queuesList', (list) => {
      callback(list);
    }),
  subscribeQueueData: (callback) =>
    ipcOn('queueData', (res) => {
      callback(res);
    }),
  removeDirectory: (id?: string) => ipcInvoke('removeDirectory', id),
  updateDirectory: (id: string, data: DataToUpdate) => ipcInvoke('updateDirectory', id, data),
  runService: (id: string) => ipcInvoke('runService', id),
  stopService: (id: string) => ipcInvoke('stopService', id),
  openProjectInBrowser: (id: string) => ipcInvoke('openProjectInBrowser', id),
  getQueues: (id: string) => ipcInvoke('getQueues', id),
  sendQueueMessage: (queueUrl: string, message: string) => ipcInvoke('sendQueueMessage', queueUrl, message),
  purgeQueue: (queueUrl: string) => ipcInvoke('purgeQueue', queueUrl),
  deleteQueue: (queueUrl: string) => ipcInvoke('deleteQueue', queueUrl),
  createQueue: (name: string, options: CreateQueueOptions) => ipcInvoke('createQueue', name, options),
  pollQueue: (queueUrl: string) => ipcInvoke('pollQueue', queueUrl),
  getQueueData: (queueUrl: string) => ipcInvoke('getQueueData', queueUrl),
  stopPollingQueue: (queueUrl: string) => ipcInvoke('stopPollingQueue', queueUrl),
  createWorkflow: (name: string, services: string[]) => ipcInvoke('createWorkflow', name, services),
  removeWorkflow: (id: string) => ipcInvoke('removeWorkflow', id),
  updateWorkflow: (id: string, data: Omit<Workflow, 'id'>) => ipcInvoke('updateWorkflow', id, data),
  startWorkflow: (id: string) => ipcInvoke('startWorkflow', id),
  openInVSCode: (id: string) => ipcInvoke('openInVSCode', id),

} satisfies Window['electron'])

const ipcInvoke = <Key extends keyof EventPayloadMapping>(
  key: Key,
  ...args: EventPayloadMapping[Key]['args']
): Promise<EventPayloadMapping[Key]['return']> => {
  return electron.ipcRenderer.invoke(key, ...args);
};

function ipcOn<Key extends keyof EventPayloadMapping>(
  key: Key,
  callback: (payload: EventPayloadMapping[Key]['args'][0]) => void
) {
  const cb = (_: Electron.IpcRendererEvent, payload: any) => callback(payload);
  electron.ipcRenderer.on(key, cb);
  return () => electron.ipcRenderer.off(key, cb);
}