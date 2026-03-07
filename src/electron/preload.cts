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
  // DynamoDB Connection API
  getDynamoDBConnections: () => ipcInvoke('getDynamoDBConnections'),
  saveDynamoDBConnection: (config: DynamoDBConnectionConfig) => ipcInvoke('saveDynamoDBConnection', config),
  deleteDynamoDBConnection: (id: string) => ipcInvoke('deleteDynamoDBConnection', id),
  getActiveDynamoDBConnection: () => ipcInvoke('getActiveDynamoDBConnection'),
  setActiveDynamoDBConnection: (id: string) => ipcInvoke('setActiveDynamoDBConnection', id),
  testDynamoDBConnection: (id: string) => ipcInvoke('testDynamoDBConnection', id),
  subscribeDynamoDBConnectionState: (callback) =>
    ipcOn('dynamodbConnectionState', (state) => {
      callback(state);
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
    }),
  // API Client API
  apiGetWorkspaces: () => ipcInvoke('apiGetWorkspaces'),
  apiCreateWorkspace: (name: string) => ipcInvoke('apiCreateWorkspace', name),
  apiDeleteWorkspace: (id: string) => ipcInvoke('apiDeleteWorkspace', id),
  apiSetActiveWorkspace: (id: string) => ipcInvoke('apiSetActiveWorkspace', id),
  apiGetActiveWorkspaceId: () => ipcInvoke('apiGetActiveWorkspaceId'),
  apiImportPostmanCollection: (workspaceId: string) => ipcInvoke('apiImportPostmanCollection', workspaceId),
  apiImportPostmanEnvironment: (workspaceId: string) => ipcInvoke('apiImportPostmanEnvironment', workspaceId),
  apiCreateCollection: (workspaceId: string, name: string) => ipcInvoke('apiCreateCollection', workspaceId, name),
  apiDeleteCollection: (workspaceId: string, collectionId: string) => ipcInvoke('apiDeleteCollection', workspaceId, collectionId),
  apiUpdateCollection: (workspaceId: string, collectionId: string, data: Partial<ApiCollection>) => ipcInvoke('apiUpdateCollection', workspaceId, collectionId, data),
  apiReorderCollection: (workspaceId: string, collectionId: string, targetCollectionId: string | null, position: 'before' | 'after') => ipcInvoke('apiReorderCollection', workspaceId, collectionId, targetCollectionId, position),
  apiAddRequest: (workspaceId: string, collectionId: string, parentFolderId: string | null, config: ApiRequestConfig) => ipcInvoke('apiAddRequest', workspaceId, collectionId, parentFolderId, config),
  apiAddFolder: (workspaceId: string, collectionId: string, parentFolderId: string | null, name: string) => ipcInvoke('apiAddFolder', workspaceId, collectionId, parentFolderId, name),
  apiUpdateRequest: (workspaceId: string, collectionId: string, itemId: string, config: ApiRequestConfig) => ipcInvoke('apiUpdateRequest', workspaceId, collectionId, itemId, config),
  apiRenameItem: (workspaceId: string, collectionId: string, itemId: string, name: string) => ipcInvoke('apiRenameItem', workspaceId, collectionId, itemId, name),
  apiDuplicateItem: (workspaceId: string, collectionId: string, itemId: string) => ipcInvoke('apiDuplicateItem', workspaceId, collectionId, itemId),
  apiDeleteItem: (workspaceId: string, collectionId: string, itemId: string) => ipcInvoke('apiDeleteItem', workspaceId, collectionId, itemId),
  apiMoveItem: (workspaceId: string, sourceCollectionId: string, itemId: string, targetCollectionId: string, targetId: string | null, position: 'before' | 'after' | 'inside') => ipcInvoke('apiMoveItem', workspaceId, sourceCollectionId, itemId, targetCollectionId, targetId, position),
  apiUpdateFolderAuth: (workspaceId: string, collectionId: string, folderId: string, auth: ApiAuth) => ipcInvoke('apiUpdateFolderAuth', workspaceId, collectionId, folderId, auth),
  apiUpdateCollectionAuth: (workspaceId: string, collectionId: string, auth: ApiAuth) => ipcInvoke('apiUpdateCollectionAuth', workspaceId, collectionId, auth),
  apiGetResolvedAuth: (workspaceId: string, collectionId: string, requestId: string) => ipcInvoke('apiGetResolvedAuth', workspaceId, collectionId, requestId),
  apiGetEnvironments: (workspaceId: string) => ipcInvoke('apiGetEnvironments', workspaceId),
  apiCreateEnvironment: (workspaceId: string, name: string) => ipcInvoke('apiCreateEnvironment', workspaceId, name),
  apiUpdateEnvironment: (workspaceId: string, envId: string, env: ApiEnvironment) => ipcInvoke('apiUpdateEnvironment', workspaceId, envId, env),
  apiDeleteEnvironment: (workspaceId: string, envId: string) => ipcInvoke('apiDeleteEnvironment', workspaceId, envId),
  apiSetActiveEnvironment: (workspaceId: string, envId: string | null) => ipcInvoke('apiSetActiveEnvironment', workspaceId, envId),
  apiSendRequest: (workspaceId: string, config: ApiRequestConfig, requestId?: string, collectionId?: string) => ipcInvoke('apiSendRequest', workspaceId, config, requestId, collectionId),
  apiCancelRequest: () => ipcInvoke('apiCancelRequest'),
  apiGetHistory: (workspaceId: string) => ipcInvoke('apiGetHistory', workspaceId),
  apiClearHistory: (workspaceId: string) => ipcInvoke('apiClearHistory', workspaceId),
  apiImportPostmanCollectionFromPath: (workspaceId: string, filePath: string) => ipcInvoke('apiImportPostmanCollectionFromPath', workspaceId, filePath),
  apiExportPostmanCollection: (workspaceId: string, collectionId: string) => ipcInvoke('apiExportPostmanCollection', workspaceId, collectionId),
  subscribeApiWorkspaces: (callback) =>
    ipcOn('subscribeApiWorkspaces', (workspaces) => {
      callback(workspaces);
    }),
  // Docker API
  dockerGetContexts: () => ipcInvoke('dockerGetContexts'),
  dockerSwitchContext: (name: string) => ipcInvoke('dockerSwitchContext', name),
  dockerGetActiveContext: () => ipcInvoke('dockerGetActiveContext'),
  dockerIsAvailable: () => ipcInvoke('dockerIsAvailable'),
  dockerGetContainers: (filters?: DockerContainerFilters) => ipcInvoke('dockerGetContainers', filters),
  dockerGetContainer: (id: string) => ipcInvoke('dockerGetContainer', id),
  dockerStartContainer: (id: string, dockerContext?: string) => ipcInvoke('dockerStartContainer', id, dockerContext),
  dockerStopContainer: (id: string, dockerContext?: string) => ipcInvoke('dockerStopContainer', id, dockerContext),
  dockerRestartContainer: (id: string, dockerContext?: string) => ipcInvoke('dockerRestartContainer', id, dockerContext),
  dockerPauseContainer: (id: string, dockerContext?: string) => ipcInvoke('dockerPauseContainer', id, dockerContext),
  dockerUnpauseContainer: (id: string, dockerContext?: string) => ipcInvoke('dockerUnpauseContainer', id, dockerContext),
  dockerRemoveContainer: (id: string, force: boolean, dockerContext?: string) => ipcInvoke('dockerRemoveContainer', id, force, dockerContext),
  dockerExecInContainer: (id: string, command: string[]) => ipcInvoke('dockerExecInContainer', id, command),
  dockerInspectContainer: (id: string) => ipcInvoke('dockerInspectContainer', id),
  dockerGetContainerLogs: (id: string, options: DockerLogOptions) => ipcInvoke('dockerGetContainerLogs', id, options),
  dockerStreamContainerLogs: (id: string, options: DockerLogOptions) => ipcInvoke('dockerStreamContainerLogs', id, options),
  dockerStopLogStream: (id: string) => ipcInvoke('dockerStopLogStream', id),
  dockerGetContainerStats: (id: string) => ipcInvoke('dockerGetContainerStats', id),
  dockerGetAllStats: () => ipcInvoke('dockerGetAllStats'),
  dockerGetImages: () => ipcInvoke('dockerGetImages'),
  dockerPullImage: (name: string) => ipcInvoke('dockerPullImage', name),
  dockerRemoveImage: (id: string, force: boolean, dockerContext?: string) => ipcInvoke('dockerRemoveImage', id, force, dockerContext),
  dockerInspectImage: (id: string) => ipcInvoke('dockerInspectImage', id),
  dockerGetImageHistory: (id: string) => ipcInvoke('dockerGetImageHistory', id),
  dockerPruneImages: (danglingOnly: boolean) => ipcInvoke('dockerPruneImages', danglingOnly),
  dockerGetVolumes: () => ipcInvoke('dockerGetVolumes'),
  dockerCreateVolume: (name: string, labels?: Record<string, string>) => ipcInvoke('dockerCreateVolume', name, labels),
  dockerRemoveVolume: (name: string, dockerContext?: string) => ipcInvoke('dockerRemoveVolume', name, dockerContext),
  dockerPruneVolumes: () => ipcInvoke('dockerPruneVolumes'),
  dockerGetNetworks: () => ipcInvoke('dockerGetNetworks'),
  dockerCreateNetwork: (name: string, driver: string) => ipcInvoke('dockerCreateNetwork', name, driver),
  dockerRemoveNetwork: (id: string, dockerContext?: string) => ipcInvoke('dockerRemoveNetwork', id, dockerContext),
  dockerInspectNetwork: (id: string) => ipcInvoke('dockerInspectNetwork', id),
  dockerGetComposeProjects: () => ipcInvoke('dockerGetComposeProjects'),
  dockerComposeUp: (project: string) => ipcInvoke('dockerComposeUp', project),
  dockerComposeDown: (project: string) => ipcInvoke('dockerComposeDown', project),
  dockerComposeRestart: (project: string) => ipcInvoke('dockerComposeRestart', project),
  dockerGetDashboardStats: () => ipcInvoke('dockerGetDashboardStats'),
  dockerGetSystemInfo: () => ipcInvoke('dockerGetSystemInfo'),
  dockerSystemPrune: (includeVolumes: boolean) => ipcInvoke('dockerSystemPrune', includeVolumes),
  subscribeDockerContainers: (callback) =>
    ipcOn('subscribeDockerContainers', (containers) => {
      callback(containers);
    }),
  subscribeDockerStats: (callback) =>
    ipcOn('subscribeDockerStats', (stats) => {
      callback(stats);
    }),
  subscribeDockerLogs: (callback) =>
    ipcOn('subscribeDockerLogs', (data) => {
      callback(data);
    }),
  // MongoDB API
  mongoGetConnections: () => ipcInvoke('mongoGetConnections'),
  mongoGetActiveConnectionId: () => ipcInvoke('mongoGetActiveConnectionId'),
  mongoSaveConnection: (config: MongoConnectionConfig) => ipcInvoke('mongoSaveConnection', config),
  mongoDeleteConnection: (id: string) => ipcInvoke('mongoDeleteConnection', id),
  mongoTestConnection: (id: string) => ipcInvoke('mongoTestConnection', id),
  mongoSetActiveConnection: (id: string) => ipcInvoke('mongoSetActiveConnection', id),
  mongoDisconnect: () => ipcInvoke('mongoDisconnect'),
  mongoGetDatabases: () => ipcInvoke('mongoGetDatabases'),
  mongoCreateDatabase: (dbName: string, collectionName: string) => ipcInvoke('mongoCreateDatabase', dbName, collectionName),
  mongoDropDatabase: (dbName: string) => ipcInvoke('mongoDropDatabase', dbName),
  mongoGetCollections: (database: string) => ipcInvoke('mongoGetCollections', database),
  mongoCreateCollection: (database: string, name: string) => ipcInvoke('mongoCreateCollection', database, name),
  mongoDropCollection: (database: string, name: string) => ipcInvoke('mongoDropCollection', database, name),
  mongoRenameCollection: (database: string, oldName: string, newName: string) => ipcInvoke('mongoRenameCollection', database, oldName, newName),
  mongoGetCollectionStats: (database: string, collection: string) => ipcInvoke('mongoGetCollectionStats', database, collection),
  mongoFindDocuments: (database: string, collection: string, options: MongoQueryOptions) => ipcInvoke('mongoFindDocuments', database, collection, options),
  mongoFindDocumentById: (database: string, collection: string, id: string) => ipcInvoke('mongoFindDocumentById', database, collection, id),
  mongoInsertDocument: (database: string, collection: string, document: Record<string, unknown>) => ipcInvoke('mongoInsertDocument', database, collection, document),
  mongoUpdateDocument: (database: string, collection: string, id: string, update: Record<string, unknown>) => ipcInvoke('mongoUpdateDocument', database, collection, id, update),
  mongoDeleteDocument: (database: string, collection: string, id: string) => ipcInvoke('mongoDeleteDocument', database, collection, id),
  mongoInsertMany: (database: string, collection: string, documents: Record<string, unknown>[]) => ipcInvoke('mongoInsertMany', database, collection, documents),
  mongoDeleteMany: (database: string, collection: string, filter: Record<string, unknown>) => ipcInvoke('mongoDeleteMany', database, collection, filter),
  mongoExplainQuery: (database: string, collection: string, options: MongoQueryOptions) => ipcInvoke('mongoExplainQuery', database, collection, options),
  mongoRunAggregation: (database: string, collection: string, pipeline: MongoAggregationStage[]) => ipcInvoke('mongoRunAggregation', database, collection, pipeline),
  mongoAnalyzeSchema: (database: string, collection: string, sampleSize?: number) => ipcInvoke('mongoAnalyzeSchema', database, collection, sampleSize),
  mongoGetIndexes: (database: string, collection: string) => ipcInvoke('mongoGetIndexes', database, collection),
  mongoCreateIndex: (database: string, collection: string, options: MongoCreateIndexOptions) => ipcInvoke('mongoCreateIndex', database, collection, options),
  mongoDropIndex: (database: string, collection: string, indexName: string) => ipcInvoke('mongoDropIndex', database, collection, indexName),
  mongoGetValidationRules: (database: string, collection: string) => ipcInvoke('mongoGetValidationRules', database, collection),
  mongoSetValidationRules: (database: string, collection: string, rules: MongoValidationRules) => ipcInvoke('mongoSetValidationRules', database, collection, rules),
  mongoExportCollection: (database: string, collection: string, format: 'json' | 'jsonl' | 'csv', options?: MongoQueryOptions) => ipcInvoke('mongoExportCollection', database, collection, format, options),
  mongoImportDocuments: (database: string, collection: string) => ipcInvoke('mongoImportDocuments', database, collection),
  mongoGetSavedQueries: () => ipcInvoke('mongoGetSavedQueries'),
  mongoSaveQuery: (query: MongoSavedQuery) => ipcInvoke('mongoSaveQuery', query),
  mongoDeleteSavedQuery: (id: string) => ipcInvoke('mongoDeleteSavedQuery', id),
  subscribeMongoConnectionState: (callback) =>
    ipcOn('subscribeMongoConnectionState', (state) => {
      callback(state);
    }),
  // AI Automation API
  aiGetTasks: () => ipcInvoke('aiGetTasks'),
  aiCreateTask: (title: string, description: string, gitStrategy: AIGitStrategy, maxReviewCycles: number, projectPaths?: string[], baseBranch?: string, customBranchName?: string, worktreeDir?: string) =>
    ipcInvoke('aiCreateTask', title, description, gitStrategy, maxReviewCycles, projectPaths, baseBranch, customBranchName, worktreeDir),
  aiSelectWorktreeDir: () => ipcInvoke('aiSelectWorktreeDir'),
  aiUpdateTask: (id: string, updates: Partial<AITask>) => ipcInvoke('aiUpdateTask', id, updates),
  aiDeleteTask: (id: string) => ipcInvoke('aiDeleteTask', id),
  aiMoveTaskPhase: (id: string, targetPhase: string) => ipcInvoke('aiMoveTaskPhase', id, targetPhase),
  aiStopTask: (id: string) => ipcInvoke('aiStopTask', id),
  aiSendTaskInput: (taskId: string, input: string) => ipcInvoke('aiSendTaskInput', taskId, input),
  aiGetTaskOutputHistory: (taskId: string) => ipcInvoke('aiGetTaskOutputHistory', taskId),
  aiGetTaskDiff: (taskId: string) => ipcInvoke('aiGetTaskDiff', taskId),
  aiRemoveWorktree: (taskId: string) => ipcInvoke('aiRemoveWorktree', taskId),
  aiGetTaskFiles: (taskId: string) => ipcInvoke('aiGetTaskFiles', taskId),
  aiReadTaskFile: (taskId: string, filename: string) => ipcInvoke('aiReadTaskFile', taskId, filename),
  aiGetSettings: () => ipcInvoke('aiGetSettings'),
  aiUpdateSettings: (updates: Partial<AIAutomationSettings>) => ipcInvoke('aiUpdateSettings', updates),
  subscribeAITasks: (callback: (tasks: AITask[]) => void) =>
    ipcOn('aiTasks', (tasks) => {
      callback(tasks);
    }),
  subscribeAITaskOutput: (callback: (data: AITaskOutput) => void) =>
    ipcOn('aiTaskOutput', (data) => {
      callback(data);
    }),
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
