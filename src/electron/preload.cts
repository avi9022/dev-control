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
  subscribeUpdateNotificationSettings: (callback) =>
    ipcOn('updateNotificationSettings', (res) => {
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
  markUserAsPrompted: () => ipcInvoke('markUserAsPrompted'),
  refuseUpdates: () => ipcInvoke('refuseUpdates'),
  updateSystem: () => ipcInvoke('updateSystem'),
  getLogs: (dirId: string) => ipcInvoke('getLogs', dirId),
  clearLogs: (dirId: string) => ipcInvoke('clearLogs', dirId),
  getLogsChunk: (dirId: string, offset: number, limit: number) => ipcInvoke('getLogsChunk', dirId, offset, limit),
  getLogsTail: (dirId: string, limit: number) => ipcInvoke('getLogsTail', dirId, limit),
  getLogFileLineCount: (dirId: string) => ipcInvoke('getLogFileLineCount', dirId),
  searchLogs: (dirId: string, searchTerm: string) => ipcInvoke('searchLogs', dirId, searchTerm),
  getLogsRange: (dirId: string, startLine: number, endLine: number) => ipcInvoke('getLogsRange', dirId, startLine, endLine),
  // Todo API
  getTodosForDate: (date: string) => ipcInvoke('getTodosForDate', date),
  saveTodosForDate: (date: string, todos: Todo[]) => ipcInvoke('saveTodosForDate', date, todos),
  getTodoFolderPath: () => ipcInvoke('getTodoFolderPath'),
  setTodoFolderPath: (path: string) => ipcInvoke('setTodoFolderPath', path),
  getAvailableDates: () => ipcInvoke('getAvailableDates'),
  getTodoSettings: () => ipcInvoke('getTodoSettings'),
  setTodoSettings: (settings: TodoSettings) => ipcInvoke('setTodoSettings', settings),
  hideOverlay: () => ipcInvoke('hideOverlay'),
  selectTodoFolder: () => ipcInvoke('selectTodoFolder'),
  subscribeTodosFileChanged: (callback) =>
    ipcOn('todosFileChanged', (data) => {
      callback(data);
    }),
  // Important Values API
  getImportantValues: () => ipcInvoke('getImportantValues'),
  saveImportantValues: (values: ImportantValue[]) => ipcInvoke('saveImportantValues', values),
  subscribeImportantValuesFileChanged: (callback) =>
    ipcOn('importantValuesFileChanged', () => {
      callback();
    }),
  // DynamoDB API
  dynamodbListTables: () => ipcInvoke('dynamodbListTables'),
  dynamodbDescribeTable: (tableName: string) => ipcInvoke('dynamodbDescribeTable', tableName),
  dynamodbScanTable: (tableName: string, options?: DynamoDBScanOptions) => ipcInvoke('dynamodbScanTable', tableName, options || {}),
  dynamodbQueryTable: (tableName: string, options: DynamoDBQueryOptions) => ipcInvoke('dynamodbQueryTable', tableName, options),
  dynamodbGetItem: (tableName: string, key: Record<string, unknown>) => ipcInvoke('dynamodbGetItem', tableName, key),
  dynamodbPutItem: (tableName: string, item: Record<string, unknown>) => ipcInvoke('dynamodbPutItem', tableName, item),
  dynamodbDeleteItem: (tableName: string, key: Record<string, unknown>) => ipcInvoke('dynamodbDeleteItem', tableName, key),
  // Broker API
  getBrokerConfigs: () => ipcInvoke('getBrokerConfigs'),
  saveBrokerConfig: (config: BrokerConfig) => ipcInvoke('saveBrokerConfig', config),
  getActiveBroker: () => ipcInvoke('getActiveBroker'),
  setActiveBroker: (type: BrokerType) => ipcInvoke('setActiveBroker', type),
  testBrokerConnection: (type: BrokerType) => ipcInvoke('testBrokerConnection', type),
  purgeAllQueues: () => ipcInvoke('purgeAllQueues'),
  subscribeBrokerConnectionState: (callback) =>
    ipcOn('brokerConnectionState', (state) => {
      callback(state);
    })
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
