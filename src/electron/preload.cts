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
  subscribeWorkflowProgress: (callback) => ipcOn('workflowProgress', (progress) => {
    callback(progress);
  }),
  subscribeWorkflowStatusMap: (callback) => ipcOn('workflowStatusMap', (statusMap) => {
    callback(statusMap);
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
  createWorkflow: (data: Omit<EnhancedWorkflow, 'id' | 'createdAt' | 'updatedAt'>) => ipcInvoke('createWorkflow', data),
  removeWorkflow: (id: string) => ipcInvoke('removeWorkflow', id),
  updateWorkflow: (id: string, data: Omit<EnhancedWorkflow, 'id' | 'createdAt' | 'updatedAt'>) => ipcInvoke('updateWorkflow', id, data),
  startWorkflow: (id: string) => ipcInvoke('startWorkflow', id),
  stopWorkflow: (id: string) => ipcInvoke('stopWorkflow', id),
  cancelWorkflow: (id: string) => ipcInvoke('cancelWorkflow', id),
  duplicateWorkflow: (id: string) => ipcInvoke('duplicateWorkflow', id),
  getWorkflowExecutionHistory: (id: string) => ipcInvoke('getWorkflowExecutionHistory', id),
  openInIDE: (id: string, command: string) => ipcInvoke('openInIDE', id, command),
  getAvailableIDEs: () => ipcInvoke('getAvailableIDEs'),
  openInFinder: (path: string) => ipcInvoke('openInFinder', path),
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
  dockerGetContainer: (id: string, dockerContext?: string) => ipcInvoke('dockerGetContainer', id, dockerContext),
  dockerStartContainer: (id: string, dockerContext?: string) => ipcInvoke('dockerStartContainer', id, dockerContext),
  dockerStopContainer: (id: string, dockerContext?: string) => ipcInvoke('dockerStopContainer', id, dockerContext),
  dockerRestartContainer: (id: string, dockerContext?: string) => ipcInvoke('dockerRestartContainer', id, dockerContext),
  dockerPauseContainer: (id: string, dockerContext?: string) => ipcInvoke('dockerPauseContainer', id, dockerContext),
  dockerUnpauseContainer: (id: string, dockerContext?: string) => ipcInvoke('dockerUnpauseContainer', id, dockerContext),
  dockerRemoveContainer: (id: string, force: boolean, dockerContext?: string) => ipcInvoke('dockerRemoveContainer', id, force, dockerContext),
  dockerExecInContainer: (id: string, command: string[], dockerContext?: string) => ipcInvoke('dockerExecInContainer', id, command, dockerContext),
  // Interactive Exec
  dockerExecInteractive: (containerId: string, shell: string, dockerContext?: string) => ipcInvoke('dockerExecInteractive', containerId, shell, dockerContext),
  dockerExecInput: (sessionId: string, data: string) => ipcInvoke('dockerExecInput', sessionId, data),
  dockerExecResize: (sessionId: string, cols: number, rows: number) => ipcInvoke('dockerExecResize', sessionId, cols, rows),
  dockerExecClose: (sessionId: string) => ipcInvoke('dockerExecClose', sessionId),
  // File Manager
  dockerListDirectory: (containerId: string, path: string, dockerContext?: string) => ipcInvoke('dockerListDirectory', containerId, path, dockerContext),
  dockerReadFile: (containerId: string, path: string, maxSize?: number, dockerContext?: string) => ipcInvoke('dockerReadFile', containerId, path, maxSize, dockerContext),
  dockerDownloadFile: (containerId: string, remotePath: string, isDirectory?: boolean, dockerContext?: string) => ipcInvoke('dockerDownloadFile', containerId, remotePath, isDirectory, dockerContext),
  dockerUploadFile: (containerId: string, localPath: string, remotePath: string, dockerContext?: string) => ipcInvoke('dockerUploadFile', containerId, localPath, remotePath, dockerContext),
  dockerUploadFiles: (containerId: string, localPaths: string[], remotePath: string, dockerContext?: string) => ipcInvoke('dockerUploadFiles', containerId, localPaths, remotePath, dockerContext),
  dockerUploadFileDialog: (containerId: string, remotePath: string, dockerContext?: string) => ipcInvoke('dockerUploadFileDialog', containerId, remotePath, dockerContext),
  dockerCreateDirectory: (containerId: string, path: string, dockerContext?: string) => ipcInvoke('dockerCreateDirectory', containerId, path, dockerContext),
  dockerDeletePath: (containerId: string, path: string, recursive?: boolean, dockerContext?: string) => ipcInvoke('dockerDeletePath', containerId, path, recursive, dockerContext),
  dockerRenamePath: (containerId: string, oldPath: string, newPath: string, dockerContext?: string) => ipcInvoke('dockerRenamePath', containerId, oldPath, newPath, dockerContext),
  dockerStartDrag: (containerId: string, remotePath: string, dockerContext?: string) => ipcInvoke('dockerStartDrag', containerId, remotePath, dockerContext),
  dockerInspectContainer: (id: string, dockerContext?: string) => ipcInvoke('dockerInspectContainer', id, dockerContext),
  dockerGetContainerLogs: (id: string, options: DockerLogOptions, dockerContext?: string) => ipcInvoke('dockerGetContainerLogs', id, options, dockerContext),
  dockerStreamContainerLogs: (id: string, options: DockerLogOptions, dockerContext?: string) => ipcInvoke('dockerStreamContainerLogs', id, options, dockerContext),
  dockerStopLogStream: (id: string) => ipcInvoke('dockerStopLogStream', id),
  dockerGetContainerStats: (id: string, dockerContext?: string) => ipcInvoke('dockerGetContainerStats', id, dockerContext),
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
  subscribeDockerExecOutput: (callback) =>
    ipcOn('subscribeDockerExecOutput', (data) => {
      callback(data);
    }),
  subscribeDockerExecClosed: (callback) =>
    ipcOn('subscribeDockerExecClosed', (data) => {
      callback(data);
    }),
  // SQL Developer API
  sqlGetConnections: () => ipcInvoke('sqlGetConnections'),
  sqlSaveConnection: (config: SQLConnectionConfig) => ipcInvoke('sqlSaveConnection', config),
  sqlDeleteConnection: (id: string) => ipcInvoke('sqlDeleteConnection', id),
  sqlTestConnection: (id: string) => ipcInvoke('sqlTestConnection', id),
  sqlSetActiveConnection: (id: string) => ipcInvoke('sqlSetActiveConnection', id),
  sqlDisconnect: () => ipcInvoke('sqlDisconnect'),
  sqlGetActiveConnectionId: () => ipcInvoke('sqlGetActiveConnectionId'),
  sqlExecuteQuery: (sql: string, params?: unknown[]) => ipcInvoke('sqlExecuteQuery', sql, params),
  sqlExecuteScript: (sql: string) => ipcInvoke('sqlExecuteScript', sql),
  sqlCancelQuery: (queryId: string) => ipcInvoke('sqlCancelQuery', queryId),
  sqlExplainPlan: (sql: string) => ipcInvoke('sqlExplainPlan', sql),
  sqlEnableDbmsOutput: () => ipcInvoke('sqlEnableDbmsOutput'),
  sqlGetDbmsOutput: () => ipcInvoke('sqlGetDbmsOutput'),
  sqlGetSchemas: (includeSystem?: boolean) => ipcInvoke('sqlGetSchemas', includeSystem),
  sqlGetTables: (schema: string) => ipcInvoke('sqlGetTables', schema),
  sqlGetViews: (schema: string) => ipcInvoke('sqlGetViews', schema),
  sqlGetSequences: (schema: string) => ipcInvoke('sqlGetSequences', schema),
  sqlGetProcedures: (schema: string) => ipcInvoke('sqlGetProcedures', schema),
  sqlGetFunctions: (schema: string) => ipcInvoke('sqlGetFunctions', schema),
  sqlGetPackages: (schema: string) => ipcInvoke('sqlGetPackages', schema),
  sqlGetTriggers: (schema: string) => ipcInvoke('sqlGetTriggers', schema),
  sqlGetTableColumns: (schema: string, table: string) => ipcInvoke('sqlGetTableColumns', schema, table),
  sqlGetTableConstraints: (schema: string, table: string) => ipcInvoke('sqlGetTableConstraints', schema, table),
  sqlGetTableIndexes: (schema: string, table: string) => ipcInvoke('sqlGetTableIndexes', schema, table),
  sqlGetTableTriggers: (schema: string, table: string) => ipcInvoke('sqlGetTableTriggers', schema, table),
  sqlGetObjectDDL: (schema: string, objectName: string, objectType: string) => ipcInvoke('sqlGetObjectDDL', schema, objectName, objectType),
  sqlGetTableRowCount: (schema: string, table: string) => ipcInvoke('sqlGetTableRowCount', schema, table),
  sqlDescribeObject: (schema: string, name: string) => ipcInvoke('sqlDescribeObject', schema, name),
  sqlGetTableGrants: (schema: string, table: string) => ipcInvoke('sqlGetTableGrants', schema, table),
  sqlGetSchemaColumnMap: (schema: string) => ipcInvoke('sqlGetSchemaColumnMap', schema),
  sqlGetHistory: () => ipcInvoke('sqlGetHistory'),
  sqlClearHistory: () => ipcInvoke('sqlClearHistory'),
  sqlGetSavedQueries: () => ipcInvoke('sqlGetSavedQueries'),
  sqlSaveQuery: (query: SQLSavedQuery) => ipcInvoke('sqlSaveQuery', query),
  sqlDeleteSavedQuery: (id: string) => ipcInvoke('sqlDeleteSavedQuery', id),
  subscribeSQLConnectionState: (callback: (state: SQLConnectionState) => void) =>
    ipcOn('subscribeSQLConnectionState', (state: SQLConnectionState) => {
      callback(state)
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
