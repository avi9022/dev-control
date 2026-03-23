type EventPayloadMapping = {
  getDirectories: {
    return: DirectorySettings[];
    args: [];
  };
  getQueues: {
    return: QueueSettings[];
    args: [string];
  };
  getQueueData: {
    return: QueueData;
    args: [string];
  };
  checkServiceState: {
    return: DirectoryState;
    args: [string];
  };
  directories: {
    return: DirectorySettings[];
    args: [DirectorySettings[]];
  };
  workflows: {
    return: EnhancedWorkflow[];
    args: [EnhancedWorkflow[]];
  };
  updateNotificationSettings: {
    return: UpdateNotificationSettings;
    args: [UpdateNotificationSettings];
  };
  logs: {
    return: Log;
    args: [Log];
  };
  directoriesMapByState: {
    return: DirectoryMapByState;
    args: [DirectoryMapByState];
  };
  queueData: {
    return: { queueUrl: string, data: QueueData };
    args: [{ queueUrl: string, data: QueueData }];
  };
  queuesList: {
    return: string[];
    args: [string[]];
  };
  addDirectoriesFromFolder: {
    return: void;
    args: [];
  };
  removeDirectory: {
    return: void;
    args: [string | undefined];
  };
  pollQueue: {
    return: boolean;
    args: [string];
  };
  stopPollingQueue: {
    return: boolean;
    args: [string];
  };
  sendQueueMessage: {
    return: void;
    args: [string, string];
  };
  purgeQueue: {
    return: void;
    args: [string];
  };
  deleteQueue: {
    return: void;
    args: [string];
  };
  createQueue: {
    return: string | undefined;
    args: [string, CreateQueueOptions];
  };
  openProjectInBrowser: {
    return: void;
    args: [string];
  };
  openExternalUrl: {
    return: void;
    args: [string];
  };
  shellSpawn: {
    return: string; // shellId
    args: [string]; // cwd
  };
  shellWrite: {
    return: void;
    args: [string, string]; // shellId, data
  };
  shellResize: {
    return: void;
    args: [string, number, number]; // shellId, cols, rows
  };
  shellKill: {
    return: void;
    args: [string]; // shellId
  };
  updateDirectory: {
    return: void;
    args: [string, DataToUpdate];
  };
  runService: {
    return: void;
    args: [string]
  }
  stopService: {
    return: void;
    args: [string]
  }
  getWorkflows: {
    return: EnhancedWorkflow[],
    args: []
  },
  createWorkflow: {
    return: void;
    args: [Omit<EnhancedWorkflow, 'id' | 'createdAt' | 'updatedAt'>]
  }
  removeWorkflow: {
    return: void;
    args: [string]
  }
  updateWorkflow: {
    return: void;
    args: [string, Omit<EnhancedWorkflow, 'id' | 'createdAt' | 'updatedAt'>]
  }
  startWorkflow: {
    return: void;
    args: [string]
  }
  stopWorkflow: {
    return: void;
    args: [string]
  }
  cancelWorkflow: {
    return: void;
    args: [string]
  }
  duplicateWorkflow: {
    return: void;
    args: [string]
  }
  getWorkflowExecutionHistory: {
    return: WorkflowExecutionRecord[];
    args: [string]
  }
  workflowProgress: {
    return: WorkflowExecutionProgress;
    args: [WorkflowExecutionProgress];
  }
  workflowStatusMap: {
    return: Record<string, WorkflowStatus>;
    args: [Record<string, WorkflowStatus>];
  }
  markUserAsPrompted: {
    return: void;
    args: []
  }
  refuseUpdates: {
    return: void;
    args: []
  }
  updateSystem: {
    return: void;
    args: []
  }
  openInIDE: {
    return: void;
    args: [string, string]
  }
  getAvailableIDEs: {
    return: Array<{ name: string; command: string }>;
    args: []
  }
  openInFinder: {
    return: void;
    args: [string]
  }
  getLogs: {
    return: string[];
    args: [string]
  }
  clearLogs: {
    return: boolean;
    args: [string]
  }
  getLogsChunk: {
    return: string[];
    args: [string, number, number]
  }
  getLogsTail: {
    return: string[];
    args: [string, number]
  }
  getLogFileLineCount: {
    return: number;
    args: [string]
  }
  searchLogs: {
    return: Array<{ lineNumber: number, line: string }>;
    args: [string, string]
  }
  getLogsRange: {
    return: string[];
    args: [string, number, number]
  }
  // Todo handlers
  getTodosForDate: {
    return: Todo[];
    args: [string]
  }
  saveTodosForDate: {
    return: void;
    args: [string, Todo[]]
  }
  getTodoFolderPath: {
    return: string;
    args: []
  }
  setTodoFolderPath: {
    return: void;
    args: [string]
  }
  getAvailableDates: {
    return: string[];
    args: []
  }
  getTodoSettings: {
    return: TodoSettings;
    args: []
  }
  setTodoSettings: {
    return: void;
    args: [TodoSettings]
  }
  hideOverlay: {
    return: void;
    args: []
  }
  selectTodoFolder: {
    return: string | null;
    args: []
  }
  todosFileChanged: {
    return: { date: string };
    args: [{ date: string }];
  }
  // Important Values handlers
  getImportantValues: {
    return: ImportantValue[];
    args: []
  }
  saveImportantValues: {
    return: void;
    args: [ImportantValue[]]
  }
  importantValuesFileChanged: {
    return: void;
    args: []
  }
  // DynamoDB connection handlers
  getDynamoDBConnections: {
    return: DynamoDBConnectionConfig[];
    args: [];
  }
  saveDynamoDBConnection: {
    return: void;
    args: [DynamoDBConnectionConfig];
  }
  deleteDynamoDBConnection: {
    return: void;
    args: [string];
  }
  getActiveDynamoDBConnection: {
    return: string | null;
    args: [];
  }
  setActiveDynamoDBConnection: {
    return: void;
    args: [string];
  }
  testDynamoDBConnection: {
    return: DynamoDBConnectionState;
    args: [string];
  }
  dynamodbConnectionState: {
    return: DynamoDBConnectionState;
    args: [DynamoDBConnectionState];
  }
  // DynamoDB handlers
  dynamodbListTables: {
    return: string[];
    args: []
  }
  dynamodbDescribeTable: {
    return: DynamoDBTableInfo;
    args: [string]
  }
  dynamodbScanTable: {
    return: DynamoDBScanResult;
    args: [string, DynamoDBScanOptions]
  }
  dynamodbQueryTable: {
    return: DynamoDBScanResult;
    args: [string, DynamoDBQueryOptions]
  }
  dynamodbGetItem: {
    return: Record<string, unknown> | null;
    args: [string, Record<string, unknown>]
  }
  dynamodbPutItem: {
    return: void;
    args: [string, Record<string, unknown>]
  }
  dynamodbDeleteItem: {
    return: void;
    args: [string, Record<string, unknown>]
  }
  // Broker handlers
  getBrokerConfigs: {
    return: BrokerConfig[];
    args: [];
  }
  saveBrokerConfig: {
    return: void;
    args: [BrokerConfig];
  }
  getActiveBroker: {
    return: BrokerType;
    args: [];
  }
  setActiveBroker: {
    return: void;
    args: [BrokerType];
  }
  testBrokerConnection: {
    return: BrokerConnectionState;
    args: [BrokerType];
  }
  brokerConnectionState: {
    return: BrokerConnectionState;
    args: [BrokerConnectionState];
  }
  purgeAllQueues: {
    return: void;
    args: [];
  }
  // ─── API Client handlers ───
  apiGetWorkspaces: {
    return: ApiWorkspace[];
    args: [];
  }
  apiCreateWorkspace: {
    return: ApiWorkspace;
    args: [string];
  }
  apiDeleteWorkspace: {
    return: void;
    args: [string];
  }
  apiSetActiveWorkspace: {
    return: void;
    args: [string];
  }
  apiGetActiveWorkspaceId: {
    return: string | null;
    args: [];
  }
  apiImportPostmanCollection: {
    return: ApiCollection[];
    args: [string];
  }
  apiImportPostmanEnvironment: {
    return: ApiEnvironment[];
    args: [string];
  }
  apiCreateCollection: {
    return: ApiCollection;
    args: [string, string];
  }
  apiDeleteCollection: {
    return: void;
    args: [string, string];
  }
  apiUpdateCollection: {
    return: void;
    args: [string, string, Partial<ApiCollection>];
  }
  apiReorderCollection: {
    return: void;
    args: [string, string, string | null, 'before' | 'after'];
  }
  apiAddRequest: {
    return: ApiCollectionItem;
    args: [string, string, string | null, ApiRequestConfig];
  }
  apiAddFolder: {
    return: ApiCollectionItem;
    args: [string, string, string | null, string];
  }
  apiUpdateRequest: {
    return: void;
    args: [string, string, string, ApiRequestConfig];
  }
  apiRenameItem: {
    return: void;
    args: [string, string, string, string];
  }
  apiDuplicateItem: {
    return: ApiCollectionItem | null;
    args: [string, string, string];
  }
  apiDeleteItem: {
    return: void;
    args: [string, string, string];
  }
  apiMoveItem: {
    return: void;
    args: [string, string, string, string, string | null, 'before' | 'after' | 'inside'];
  }
  apiUpdateFolderAuth: {
    return: void;
    args: [string, string, string, ApiAuth];
  }
  apiUpdateCollectionAuth: {
    return: void;
    args: [string, string, ApiAuth];
  }
  apiGetResolvedAuth: {
    return: ResolvedAuthInfo | null;
    args: [string, string, string];
  }
  apiGetEnvironments: {
    return: ApiEnvironment[];
    args: [string];
  }
  apiCreateEnvironment: {
    return: ApiEnvironment;
    args: [string, string];
  }
  apiUpdateEnvironment: {
    return: void;
    args: [string, string, ApiEnvironment];
  }
  apiDeleteEnvironment: {
    return: void;
    args: [string, string];
  }
  apiSetActiveEnvironment: {
    return: void;
    args: [string, string | null];
  }
  apiSendRequest: {
    return: ApiResponse;
    args: [string, ApiRequestConfig, string?, string?]; // workspaceId, config, requestId?, collectionId?
  }
  apiCancelRequest: {
    return: void;
    args: [];
  }
  apiGetHistory: {
    return: ApiHistoryEntry[];
    args: [string];
  }
  apiClearHistory: {
    return: void;
    args: [string];
  }
  apiImportPostmanCollectionFromPath: {
    return: ApiCollection;
    args: [string, string];
  }
  apiExportPostmanCollection: {
    return: void;
    args: [string, string];
  }
  subscribeApiWorkspaces: {
    return: ApiWorkspace[];
    args: [ApiWorkspace[]];
  }
  // ─── Docker handlers ───
  dockerGetContexts: {
    return: DockerContext[];
    args: [];
  }
  dockerSwitchContext: {
    return: void;
    args: [string];
  }
  dockerGetActiveContext: {
    return: string;
    args: [];
  }
  dockerIsAvailable: {
    return: boolean;
    args: [];
  }
  dockerGetContainers: {
    return: DockerContainer[];
    args: [DockerContainerFilters?];
  }
  dockerGetContainer: {
    return: DockerContainer;
    args: [string, string?];
  }
  dockerStartContainer: {
    return: void;
    args: [string, string?];
  }
  dockerStopContainer: {
    return: void;
    args: [string, string?];
  }
  dockerRestartContainer: {
    return: void;
    args: [string, string?];
  }
  dockerPauseContainer: {
    return: void;
    args: [string, string?];
  }
  dockerUnpauseContainer: {
    return: void;
    args: [string, string?];
  }
  dockerRemoveContainer: {
    return: void;
    args: [string, boolean, string?];
  }
  dockerExecInContainer: {
    return: string;
    args: [string, string[], string?];
  }
  dockerInspectContainer: {
    return: Record<string, unknown>;
    args: [string, string?];
  }
  dockerGetContainerLogs: {
    return: string[];
    args: [string, DockerLogOptions, string?];
  }
  dockerStreamContainerLogs: {
    return: void;
    args: [string, DockerLogOptions, string?];
  }
  dockerStopLogStream: {
    return: void;
    args: [string];
  }
  dockerGetContainerStats: {
    return: DockerContainerStats;
    args: [string, string?];
  }
  dockerGetAllStats: {
    return: Record<string, DockerContainerStats>;
    args: [];
  }
  dockerGetImages: {
    return: DockerImage[];
    args: [];
  }
  dockerPullImage: {
    return: void;
    args: [string];
  }
  dockerRemoveImage: {
    return: void;
    args: [string, boolean, string?];
  }
  dockerInspectImage: {
    return: Record<string, unknown>;
    args: [string];
  }
  dockerGetImageHistory: {
    return: DockerImageLayer[];
    args: [string];
  }
  dockerPruneImages: {
    return: { spaceReclaimed: number };
    args: [boolean];
  }
  dockerGetVolumes: {
    return: DockerVolume[];
    args: [];
  }
  dockerCreateVolume: {
    return: DockerVolume;
    args: [string, Record<string, string>?];
  }
  dockerRemoveVolume: {
    return: void;
    args: [string, string?];
  }
  dockerPruneVolumes: {
    return: { spaceReclaimed: number };
    args: [];
  }
  dockerGetNetworks: {
    return: DockerNetwork[];
    args: [];
  }
  dockerCreateNetwork: {
    return: DockerNetwork;
    args: [string, string];
  }
  dockerRemoveNetwork: {
    return: void;
    args: [string, string?];
  }
  dockerInspectNetwork: {
    return: DockerNetwork;
    args: [string];
  }
  dockerGetComposeProjects: {
    return: DockerComposeProject[];
    args: [];
  }
  dockerComposeUp: {
    return: void;
    args: [string];
  }
  dockerComposeDown: {
    return: void;
    args: [string];
  }
  dockerComposeRestart: {
    return: void;
    args: [string];
  }
  dockerGetDashboardStats: {
    return: DockerDashboardStats;
    args: [];
  }
  dockerGetSystemInfo: {
    return: Record<string, unknown>;
    args: [];
  }
  dockerSystemPrune: {
    return: { spaceReclaimed: number };
    args: [boolean];
  }
  subscribeDockerContainers: {
    return: DockerContainer[];
    args: [DockerContainer[]];
  }
  subscribeDockerStats: {
    return: Record<string, DockerContainerStats>;
    args: [Record<string, DockerContainerStats>];
  }
  subscribeDockerLogs: {
    return: { containerId: string; log: string };
    args: [{ containerId: string; log: string }];
  }
  // Docker Interactive Exec handlers
  dockerExecInteractive: {
    return: DockerExecSession;
    args: [string, string, string?]; // containerId, shell, dockerContext
  }
  dockerExecInput: {
    return: void;
    args: [string, string]; // sessionId, data
  }
  dockerExecResize: {
    return: void;
    args: [string, number, number]; // sessionId, cols, rows
  }
  dockerExecClose: {
    return: void;
    args: [string]; // sessionId
  }
  subscribeDockerExecOutput: {
    return: DockerExecSessionOutput;
    args: [DockerExecSessionOutput];
  }
  subscribeDockerExecClosed: {
    return: DockerExecSessionClosed;
    args: [DockerExecSessionClosed];
  }
  // Docker File Manager handlers
  dockerListDirectory: {
    return: DockerFileEntry[];
    args: [string, string, string?]; // containerId, path, dockerContext
  }
  dockerReadFile: {
    return: DockerFileContent;
    args: [string, string, number?, string?]; // containerId, path, maxSize, dockerContext
  }
  dockerDownloadFile: {
    return: string;
    args: [string, string, boolean?, string?]; // containerId, remotePath, isDirectory, dockerContext
  }
  dockerUploadFile: {
    return: void;
    args: [string, string, string, string?]; // containerId, localPath, remotePath, dockerContext
  }
  dockerUploadFiles: {
    return: number;
    args: [string, string[], string, string?]; // containerId, localPaths, remotePath, dockerContext
  }
  dockerUploadFileDialog: {
    return: number;
    args: [string, string, string?]; // containerId, remotePath, dockerContext
  }
  dockerCreateDirectory: {
    return: void;
    args: [string, string, string?]; // containerId, path, dockerContext
  }
  dockerDeletePath: {
    return: void;
    args: [string, string, boolean?, string?]; // containerId, path, recursive, dockerContext
  }
  dockerRenamePath: {
    return: void;
    args: [string, string, string, string?]; // containerId, oldPath, newPath, dockerContext
  }
  dockerStartDrag: {
    return: void;
    args: [string, string, string?]; // containerId, remotePath, dockerContext
  }
  // ─── SQL Developer handlers ───
  sqlGetConnections: { return: SQLConnectionConfig[]; args: [] }
  sqlSaveConnection: { return: void; args: [SQLConnectionConfig] }
  sqlDeleteConnection: { return: void; args: [string] }
  sqlTestConnection: { return: SQLConnectionState; args: [string] }
  sqlSetActiveConnection: { return: void; args: [string] }
  sqlDisconnect: { return: void; args: [] }
  sqlGetActiveConnectionId: { return: string | null; args: [] }
  sqlExecuteQuery: { return: SQLQueryResult; args: [string, unknown[]?] }
  sqlExecuteScript: { return: SQLScriptResult; args: [string] }
  sqlCancelQuery: { return: void; args: [string] }
  sqlExplainPlan: { return: SQLExplainPlan; args: [string] }
  sqlEnableDbmsOutput: { return: void; args: [] }
  sqlGetDbmsOutput: { return: string[]; args: [] }
  sqlGetSchemas: { return: string[]; args: [boolean?] }
  sqlGetTables: { return: SQLTableInfo[]; args: [string] }
  sqlGetViews: { return: SQLViewInfo[]; args: [string] }
  sqlGetSequences: { return: SQLSequenceInfo[]; args: [string] }
  sqlGetProcedures: { return: SQLProcedureInfo[]; args: [string] }
  sqlGetFunctions: { return: SQLFunctionInfo[]; args: [string] }
  sqlGetPackages: { return: SQLPackageInfo[]; args: [string] }
  sqlGetTriggers: { return: SQLTriggerInfo[]; args: [string] }
  sqlGetTableColumns: { return: SQLColumnDetail[]; args: [string, string] }
  sqlGetTableConstraints: { return: SQLConstraint[]; args: [string, string] }
  sqlGetTableIndexes: { return: SQLIndex[]; args: [string, string] }
  sqlGetTableTriggers: { return: SQLTriggerInfo[]; args: [string, string] }
  sqlGetObjectDDL: { return: string; args: [string, string, string] }
  sqlGetTableRowCount: { return: number; args: [string, string] }
  sqlDescribeObject: { return: SQLObjectDescription; args: [string, string] }
  sqlGetTableGrants: { return: SQLGrant[]; args: [string, string] }
  sqlGetSchemaColumnMap: { return: Record<string, string[]>; args: [string] }
  sqlGetHistory: { return: SQLHistoryEntry[]; args: [] }
  sqlClearHistory: { return: void; args: [] }
  sqlGetSavedQueries: { return: SQLSavedQuery[]; args: [] }
  sqlSaveQuery: { return: void; args: [SQLSavedQuery] }
  sqlDeleteSavedQuery: { return: void; args: [string] }
  subscribeSQLConnectionState: {
    return: SQLConnectionState
    args: [SQLConnectionState]
  }
  // ─── MongoDB handlers ───
  mongoGetConnections: {
    return: MongoConnectionConfig[];
    args: [];
  }
  mongoGetActiveConnectionId: {
    return: string | null;
    args: [];
  }
  mongoSaveConnection: {
    return: void;
    args: [MongoConnectionConfig];
  }
  mongoDeleteConnection: {
    return: void;
    args: [string];
  }
  mongoTestConnection: {
    return: MongoConnectionState;
    args: [string];
  }
  mongoSetActiveConnection: {
    return: void;
    args: [string];
  }
  mongoDisconnect: {
    return: void;
    args: [];
  }
  mongoGetDatabases: {
    return: MongoDatabase[];
    args: [];
  }
  mongoCreateDatabase: {
    return: void;
    args: [string, string];
  }
  mongoDropDatabase: {
    return: void;
    args: [string];
  }
  mongoGetCollections: {
    return: MongoCollection[];
    args: [string];
  }
  mongoCreateCollection: {
    return: void;
    args: [string, string];
  }
  mongoDropCollection: {
    return: void;
    args: [string, string];
  }
  mongoRenameCollection: {
    return: void;
    args: [string, string, string];
  }
  mongoGetCollectionStats: {
    return: MongoCollectionStats;
    args: [string, string];
  }
  mongoFindDocuments: {
    return: MongoQueryResult;
    args: [string, string, MongoQueryOptions];
  }
  mongoFindDocumentById: {
    return: MongoDocument | null;
    args: [string, string, string];
  }
  mongoInsertDocument: {
    return: string;
    args: [string, string, Record<string, unknown>];
  }
  mongoUpdateDocument: {
    return: void;
    args: [string, string, string, Record<string, unknown>];
  }
  mongoDeleteDocument: {
    return: void;
    args: [string, string, string];
  }
  mongoInsertMany: {
    return: number;
    args: [string, string, Record<string, unknown>[]];
  }
  mongoDeleteMany: {
    return: number;
    args: [string, string, Record<string, unknown>];
  }
  mongoExplainQuery: {
    return: MongoExplainResult;
    args: [string, string, MongoQueryOptions];
  }
  mongoRunAggregation: {
    return: MongoAggregationResult;
    args: [string, string, MongoAggregationStage[]];
  }
  mongoAnalyzeSchema: {
    return: MongoSchemaField[];
    args: [string, string, number?];
  }
  mongoGetIndexes: {
    return: MongoIndex[];
    args: [string, string];
  }
  mongoCreateIndex: {
    return: string;
    args: [string, string, MongoCreateIndexOptions];
  }
  mongoDropIndex: {
    return: void;
    args: [string, string, string];
  }
  mongoGetValidationRules: {
    return: MongoValidationRules | null;
    args: [string, string];
  }
  mongoSetValidationRules: {
    return: void;
    args: [string, string, MongoValidationRules];
  }
  mongoExportCollection: {
    return: void;
    args: [string, string, 'json' | 'jsonl' | 'csv', MongoQueryOptions?];
  }
  mongoImportDocuments: {
    return: number;
    args: [string, string];
  }
  mongoGetSavedQueries: {
    return: MongoSavedQuery[];
    args: [];
  }
  mongoSaveQuery: {
    return: void;
    args: [MongoSavedQuery];
  }
  mongoDeleteSavedQuery: {
    return: void;
    args: [string];
  }
  subscribeMongoConnectionState: {
    return: MongoConnectionState;
    args: [MongoConnectionState];
  }
  // ─── AI Automation handlers ───
  aiGetTasks: {
    return: AITask[];
    args: [];
  }
  aiCreateTask: {
    return: AITask;
    args: [string, string, AITaskProject[], string?];
  }
  aiSelectDirectory: {
    return: string | null;
    args: [];
  }
  aiAttachTaskFiles: {
    return: string[];
    args: [string, string[]];
  }
  aiDeleteTaskAttachment: {
    return: void;
    args: [string, string];
  }
  aiDeleteAgentFile: {
    return: void;
    args: [string, string];
  }
  aiToggleFileExclusion: {
    return: void;
    args: [string, string];
  }
  aiListTaskAttachments: {
    return: string[];
    args: [string];
  }
  aiSelectFiles: {
    return: string[] | null;
    args: [];
  }
  aiUpdateTask: {
    return: void;
    args: [string, Partial<AITask>];
  }
  aiDeleteTask: {
    return: void;
    args: [string];
  }
  aiMoveTaskPhase: {
    return: void;
    args: [string, string];
  }
  aiStopTask: {
    return: void;
    args: [string];
  }
  aiSendTaskInput: {
    return: void;
    args: [string, string];
  }
  aiGetTaskOutputHistory: {
    return: string[];
    args: [string];
  }
  aiGetAgentStats: {
    return: AIAgentStats | null;
    args: [string];
  }
  aiGetNotifications: {
    return: AINotification[];
    args: [];
  }
  aiMarkNotificationsRead: {
    return: void;
    args: [];
  }
  aiGetTaskDiff: {
    return: AIProjectDiff[];
    args: [string];
  }
  aiOpenTaskDir: {
    return: void;
    args: [string];
  }
  aiCreateTaskServices: {
    return: DirectorySettings[];
    args: [string];
  }
  aiCleanupTaskServices: {
    return: void;
    args: [string];
  }
  aiRemoveWorktree: {
    return: void;
    args: [string];
  }
  aiGetTaskFiles: {
    return: string[];
    args: [string];
  }
  aiReadTaskFile: {
    return: string;
    args: [string, string];
  }
  aiReadContextHistory: {
    return: { prompt: string; events: string };
    args: [string]; // contextHistoryPath (absolute)
  }
  aiSendPlannerMessage: {
    return: string;
    args: [{ role: 'user' | 'assistant'; content: string }[], string];
  }
  aiSavePlannerConversation: {
    return: string;
    args: [string, { role: 'user' | 'assistant'; content: string }[], { type: string; [key: string]: unknown }[]];
  }
  aiGetSettings: {
    return: AIAutomationSettings;
    args: [];
  }
  aiUpdateSettings: {
    return: void;
    args: [Partial<AIAutomationSettings>];
  }
  aiGenerateKnowledgeDoc: {
    return: AIKnowledgeDoc;
    args: [string];
  }
  aiTasks: {
    return: AITask[];
    args: [AITask[]];
  }
  aiTaskOutput: {
    return: AITaskOutput;
    args: [AITaskOutput];
  }
  aiAgentStats: {
    return: AIAgentStats;
    args: [AIAgentStats];
  }
  aiPlannerChunk: {
    return: string;
    args: [string];
  }
  aiPlannerDebug: {
    return: unknown;
    args: [unknown];
  }
  aiNotifications: {
    return: AINotification[];
    args: [AINotification[]];
  }
  aiSettings: {
    return: AIAutomationSettings;
    args: [AIAutomationSettings];
  }
  aiGetBranchInfo: {
    return: AIBranchInfo[];
    args: [string]; // taskId
  }
  aiRenameBranch: {
    return: void;
    args: [string, string, string, boolean]; // taskId, worktreePath, newBranchName, pushToRemote
  }
  aiEditCommitMessage: {
    return: void;
    args: [string, string, string, boolean]; // worktreePath, commitHash, newMessage, pushToRemote
  }
  aiEditMultipleCommitMessages: {
    return: void;
    args: [string, { hash: string; newMessage: string }[], boolean]; // worktreePath, edits, pushToRemote
  }
  aiSquashCommits: {
    return: void;
    args: [string, string, string, boolean]; // worktreePath, baseBranch, newMessage, pushToRemote
  }
  shellOutput: {
    return: { shellId: string; output: string };
    args: [{ shellId: string; output: string }];
  }
  shellExit: {
    return: { shellId: string; exitCode: number };
    args: [{ shellId: string; exitCode: number }];
  }
};

interface Window {
  electron: {
    getDirectories: () => Promise<DirectorySettings[]>
    subscribeDirectories: (callback: (directories: DirectorySettings[]) => void) => () => void
    subscribeWorkflows: (callback: (flows: EnhancedWorkflow[]) => void) => () => void
    subscribeWorkflowProgress: (callback: (progress: WorkflowExecutionProgress) => void) => () => void
    subscribeWorkflowStatusMap: (callback: (statusMap: Record<string, WorkflowStatus>) => void) => () => void
    subscribeUpdateNotificationSettings: (callback: (flows: UpdateNotificationSettings) => void) => () => void
    subscribeLogs: (callback: (log: Log) => void) => () => void
    addDirectoriesFromFolder: () => Promise<void>
    updateDirectory: (id: string, data: DataToUpdate) => void
    removeDirectory: (id?: string) => void
    runService: (id: string) => void
    openProjectInBrowser: (id: string) => void
    openExternalUrl: (url: string) => void
    shellSpawn: (cwd: string) => Promise<string>
    shellWrite: (shellId: string, data: string) => void
    shellResize: (shellId: string, cols: number, rows: number) => void
    shellKill: (shellId: string) => void
    subscribeShellOutput: (callback: (data: { shellId: string; output: string }) => void) => () => void
    subscribeShellExit: (callback: (data: { shellId: string; exitCode: number }) => void) => () => void
    stopService: (id: string) => void
    checkServiceState: (id: string) => Promise<DirectoryState>
    subscribeDirectoriesState: (callback: (statesMap: DirectoryMapByState) => void) => () => void
    subscribeQueuesList: (callback: (list: string[]) => void) => () => void
    subscribeQueueData: (callback: (res: { queueUrl: string, data: QueueData }) => void) => () => void
    getQueues: (id: string) => Promise<QueueSettings[]>
    pollQueue: (urk: string) => void
    sendQueueMessage: (queueUrl: string, message: string) => void
    purgeQueue: (queueUrl: string) => void
    deleteQueue: (queueUrl: string) => void
    createQueue: (name: string, options: CreateQueueOptions) => void
    getQueueData: (queueUrl: string) => Promise<QueueData>
    stopPollingQueue: (queueUrl: string) => Promise<boolean>
    getWorkflows: () => Promise<EnhancedWorkflow[]>
    createWorkflow: (data: Omit<EnhancedWorkflow, 'id' | 'createdAt' | 'updatedAt'>) => void
    removeWorkflow: (id: string) => void
    updateWorkflow: (id: string, data: Omit<EnhancedWorkflow, 'id' | 'createdAt' | 'updatedAt'>) => void
    startWorkflow: (id: string) => void
    stopWorkflow: (id: string) => void
    cancelWorkflow: (id: string) => void
    duplicateWorkflow: (id: string) => void
    getWorkflowExecutionHistory: (id: string) => Promise<WorkflowExecutionRecord[]>
    openInIDE: (id: string, command: string) => void
    getAvailableIDEs: () => Promise<Array<{ name: string; command: string }>>
    openInFinder: (path: string) => Promise<void>
    markUserAsPrompted: () => void
    refuseUpdates: () => void
    updateSystem: () => void
    getLogs: (dirId: string) => Promise<string[]>
    clearLogs: (dirId: string) => Promise<boolean>
    getLogsChunk: (dirId: string, offset: number, limit: number) => Promise<string[]>
    getLogsTail: (dirId: string, limit: number) => Promise<string[]>
    getLogFileLineCount: (dirId: string) => Promise<number>
    searchLogs: (dirId: string, searchTerm: string) => Promise<Array<{ lineNumber: number, line: string }>>
    getLogsRange: (dirId: string, startLine: number, endLine: number) => Promise<string[]>
    // Todo API
    getTodosForDate: (date: string) => Promise<Todo[]>
    saveTodosForDate: (date: string, todos: Todo[]) => Promise<void>
    getTodoFolderPath: () => Promise<string>
    setTodoFolderPath: (path: string) => Promise<void>
    getAvailableDates: () => Promise<string[]>
    getTodoSettings: () => Promise<TodoSettings>
    setTodoSettings: (settings: TodoSettings) => Promise<void>
    hideOverlay: () => Promise<void>
    selectTodoFolder: () => Promise<string | null>
    subscribeTodosFileChanged: (callback: (data: { date: string }) => void) => () => void
    // Important Values API
    getImportantValues: () => Promise<ImportantValue[]>
    saveImportantValues: (values: ImportantValue[]) => Promise<void>
    subscribeImportantValuesFileChanged: (callback: () => void) => () => void
    // DynamoDB Connection API
    getDynamoDBConnections: () => Promise<DynamoDBConnectionConfig[]>
    saveDynamoDBConnection: (config: DynamoDBConnectionConfig) => Promise<void>
    deleteDynamoDBConnection: (id: string) => Promise<void>
    getActiveDynamoDBConnection: () => Promise<string | null>
    setActiveDynamoDBConnection: (id: string) => Promise<void>
    testDynamoDBConnection: (id: string) => Promise<DynamoDBConnectionState>
    subscribeDynamoDBConnectionState: (callback: (state: DynamoDBConnectionState) => void) => () => void
    // DynamoDB API
    dynamodbListTables: () => Promise<string[]>
    dynamodbDescribeTable: (tableName: string) => Promise<DynamoDBTableInfo>
    dynamodbScanTable: (tableName: string, options?: DynamoDBScanOptions) => Promise<DynamoDBScanResult>
    dynamodbQueryTable: (tableName: string, options: DynamoDBQueryOptions) => Promise<DynamoDBScanResult>
    dynamodbGetItem: (tableName: string, key: Record<string, unknown>) => Promise<Record<string, unknown> | null>
    dynamodbPutItem: (tableName: string, item: Record<string, unknown>) => Promise<void>
    dynamodbDeleteItem: (tableName: string, key: Record<string, unknown>) => Promise<void>
    // Broker API
    getBrokerConfigs: () => Promise<BrokerConfig[]>
    saveBrokerConfig: (config: BrokerConfig) => Promise<void>
    getActiveBroker: () => Promise<BrokerType>
    setActiveBroker: (type: BrokerType) => Promise<void>
    testBrokerConnection: (type: BrokerType) => Promise<BrokerConnectionState>
    subscribeBrokerConnectionState: (callback: (state: BrokerConnectionState) => void) => () => void
    purgeAllQueues: () => Promise<void>
    // API Client API
    apiGetWorkspaces: () => Promise<ApiWorkspace[]>
    apiCreateWorkspace: (name: string) => Promise<ApiWorkspace>
    apiDeleteWorkspace: (id: string) => Promise<void>
    apiSetActiveWorkspace: (id: string) => Promise<void>
    apiGetActiveWorkspaceId: () => Promise<string | null>
    apiImportPostmanCollection: (workspaceId: string) => Promise<ApiCollection[]>
    apiImportPostmanEnvironment: (workspaceId: string) => Promise<ApiEnvironment[]>
    apiCreateCollection: (workspaceId: string, name: string) => Promise<ApiCollection>
    apiDeleteCollection: (workspaceId: string, collectionId: string) => Promise<void>
    apiUpdateCollection: (workspaceId: string, collectionId: string, data: Partial<ApiCollection>) => Promise<void>
    apiReorderCollection: (workspaceId: string, collectionId: string, targetCollectionId: string | null, position: 'before' | 'after') => Promise<void>
    apiAddRequest: (workspaceId: string, collectionId: string, parentFolderId: string | null, config: ApiRequestConfig) => Promise<ApiCollectionItem>
    apiAddFolder: (workspaceId: string, collectionId: string, parentFolderId: string | null, name: string) => Promise<ApiCollectionItem>
    apiUpdateRequest: (workspaceId: string, collectionId: string, itemId: string, config: ApiRequestConfig) => Promise<void>
    apiRenameItem: (workspaceId: string, collectionId: string, itemId: string, name: string) => Promise<void>
    apiDuplicateItem: (workspaceId: string, collectionId: string, itemId: string) => Promise<ApiCollectionItem | null>
    apiDeleteItem: (workspaceId: string, collectionId: string, itemId: string) => Promise<void>
    apiMoveItem: (workspaceId: string, sourceCollectionId: string, itemId: string, targetCollectionId: string, targetId: string | null, position: 'before' | 'after' | 'inside') => Promise<void>
    apiUpdateFolderAuth: (workspaceId: string, collectionId: string, folderId: string, auth: ApiAuth) => Promise<void>
    apiUpdateCollectionAuth: (workspaceId: string, collectionId: string, auth: ApiAuth) => Promise<void>
    apiGetResolvedAuth: (workspaceId: string, collectionId: string, requestId: string) => Promise<ResolvedAuthInfo | null>
    apiGetEnvironments: (workspaceId: string) => Promise<ApiEnvironment[]>
    apiCreateEnvironment: (workspaceId: string, name: string) => Promise<ApiEnvironment>
    apiUpdateEnvironment: (workspaceId: string, envId: string, env: ApiEnvironment) => Promise<void>
    apiDeleteEnvironment: (workspaceId: string, envId: string) => Promise<void>
    apiSetActiveEnvironment: (workspaceId: string, envId: string | null) => Promise<void>
    apiSendRequest: (workspaceId: string, config: ApiRequestConfig, requestId?: string, collectionId?: string) => Promise<ApiResponse>
    apiCancelRequest: () => Promise<void>
    apiGetHistory: (workspaceId: string) => Promise<ApiHistoryEntry[]>
    apiClearHistory: (workspaceId: string) => Promise<void>
    apiImportPostmanCollectionFromPath: (workspaceId: string, filePath: string) => Promise<ApiCollection>
    apiExportPostmanCollection: (workspaceId: string, collectionId: string) => Promise<void>
    subscribeApiWorkspaces: (callback: (workspaces: ApiWorkspace[]) => void) => () => void
    // Docker API
    dockerGetContexts: () => Promise<DockerContext[]>
    dockerSwitchContext: (name: string) => Promise<void>
    dockerGetActiveContext: () => Promise<string>
    dockerIsAvailable: () => Promise<boolean>
    dockerGetContainers: (filters?: DockerContainerFilters) => Promise<DockerContainer[]>
    dockerGetContainer: (id: string, dockerContext?: string) => Promise<DockerContainer>
    dockerStartContainer: (id: string, dockerContext?: string) => Promise<void>
    dockerStopContainer: (id: string, dockerContext?: string) => Promise<void>
    dockerRestartContainer: (id: string, dockerContext?: string) => Promise<void>
    dockerPauseContainer: (id: string, dockerContext?: string) => Promise<void>
    dockerUnpauseContainer: (id: string, dockerContext?: string) => Promise<void>
    dockerRemoveContainer: (id: string, force: boolean, dockerContext?: string) => Promise<void>
    dockerExecInContainer: (id: string, command: string[], dockerContext?: string) => Promise<string>
    dockerInspectContainer: (id: string, dockerContext?: string) => Promise<Record<string, unknown>>
    dockerGetContainerLogs: (id: string, options: DockerLogOptions, dockerContext?: string) => Promise<string[]>
    dockerStreamContainerLogs: (id: string, options: DockerLogOptions, dockerContext?: string) => Promise<void>
    dockerStopLogStream: (id: string) => Promise<void>
    dockerGetContainerStats: (id: string, dockerContext?: string) => Promise<DockerContainerStats>
    dockerGetAllStats: () => Promise<Record<string, DockerContainerStats>>
    dockerGetImages: () => Promise<DockerImage[]>
    dockerPullImage: (name: string) => Promise<void>
    dockerRemoveImage: (id: string, force: boolean, dockerContext?: string) => Promise<void>
    dockerInspectImage: (id: string) => Promise<Record<string, unknown>>
    dockerGetImageHistory: (id: string) => Promise<DockerImageLayer[]>
    dockerPruneImages: (danglingOnly: boolean) => Promise<{ spaceReclaimed: number }>
    dockerGetVolumes: () => Promise<DockerVolume[]>
    dockerCreateVolume: (name: string, labels?: Record<string, string>) => Promise<DockerVolume>
    dockerRemoveVolume: (name: string, dockerContext?: string) => Promise<void>
    dockerPruneVolumes: () => Promise<{ spaceReclaimed: number }>
    dockerGetNetworks: () => Promise<DockerNetwork[]>
    dockerCreateNetwork: (name: string, driver: string) => Promise<DockerNetwork>
    dockerRemoveNetwork: (id: string, dockerContext?: string) => Promise<void>
    dockerInspectNetwork: (id: string) => Promise<DockerNetwork>
    dockerGetComposeProjects: () => Promise<DockerComposeProject[]>
    dockerComposeUp: (project: string) => Promise<void>
    dockerComposeDown: (project: string) => Promise<void>
    dockerComposeRestart: (project: string) => Promise<void>
    dockerGetDashboardStats: () => Promise<DockerDashboardStats>
    dockerGetSystemInfo: () => Promise<Record<string, unknown>>
    dockerSystemPrune: (includeVolumes: boolean) => Promise<{ spaceReclaimed: number }>
    subscribeDockerContainers: (callback: (containers: DockerContainer[]) => void) => () => void
    subscribeDockerStats: (callback: (stats: Record<string, DockerContainerStats>) => void) => () => void
    subscribeDockerLogs: (callback: (data: { containerId: string; log: string }) => void) => () => void
    // Docker Interactive Exec
    dockerExecInteractive: (containerId: string, shell: string, dockerContext?: string) => Promise<DockerExecSession>
    dockerExecInput: (sessionId: string, data: string) => Promise<void>
    dockerExecResize: (sessionId: string, cols: number, rows: number) => Promise<void>
    dockerExecClose: (sessionId: string) => Promise<void>
    subscribeDockerExecOutput: (callback: (data: DockerExecSessionOutput) => void) => () => void
    subscribeDockerExecClosed: (callback: (data: DockerExecSessionClosed) => void) => () => void
    // Docker File Manager
    dockerListDirectory: (containerId: string, path: string, dockerContext?: string) => Promise<DockerFileEntry[]>
    dockerReadFile: (containerId: string, path: string, maxSize?: number, dockerContext?: string) => Promise<DockerFileContent>
    dockerDownloadFile: (containerId: string, remotePath: string, isDirectory?: boolean, dockerContext?: string) => Promise<string>
    dockerUploadFile: (containerId: string, localPath: string, remotePath: string, dockerContext?: string) => Promise<void>
    dockerUploadFiles: (containerId: string, localPaths: string[], remotePath: string, dockerContext?: string) => Promise<number>
    dockerUploadFileDialog: (containerId: string, remotePath: string, dockerContext?: string) => Promise<number>
    dockerCreateDirectory: (containerId: string, path: string, dockerContext?: string) => Promise<void>
    dockerDeletePath: (containerId: string, path: string, recursive?: boolean, dockerContext?: string) => Promise<void>
    dockerRenamePath: (containerId: string, oldPath: string, newPath: string, dockerContext?: string) => Promise<void>
    dockerStartDrag: (containerId: string, remotePath: string, dockerContext?: string) => Promise<void>
    // SQL Developer API
    sqlGetConnections: () => Promise<SQLConnectionConfig[]>
    sqlSaveConnection: (config: SQLConnectionConfig) => Promise<void>
    sqlDeleteConnection: (id: string) => Promise<void>
    sqlTestConnection: (id: string) => Promise<SQLConnectionState>
    sqlSetActiveConnection: (id: string) => Promise<void>
    sqlDisconnect: () => Promise<void>
    sqlGetActiveConnectionId: () => Promise<string | null>
    sqlExecuteQuery: (sql: string, params?: unknown[]) => Promise<SQLQueryResult>
    sqlExecuteScript: (sql: string) => Promise<SQLScriptResult>
    sqlCancelQuery: (queryId: string) => Promise<void>
    sqlExplainPlan: (sql: string) => Promise<SQLExplainPlan>
    sqlEnableDbmsOutput: () => Promise<void>
    sqlGetDbmsOutput: () => Promise<string[]>
    sqlGetSchemas: (includeSystem?: boolean) => Promise<string[]>
    sqlGetTables: (schema: string) => Promise<SQLTableInfo[]>
    sqlGetViews: (schema: string) => Promise<SQLViewInfo[]>
    sqlGetSequences: (schema: string) => Promise<SQLSequenceInfo[]>
    sqlGetProcedures: (schema: string) => Promise<SQLProcedureInfo[]>
    sqlGetFunctions: (schema: string) => Promise<SQLFunctionInfo[]>
    sqlGetPackages: (schema: string) => Promise<SQLPackageInfo[]>
    sqlGetTriggers: (schema: string) => Promise<SQLTriggerInfo[]>
    sqlGetTableColumns: (schema: string, table: string) => Promise<SQLColumnDetail[]>
    sqlGetTableConstraints: (schema: string, table: string) => Promise<SQLConstraint[]>
    sqlGetTableIndexes: (schema: string, table: string) => Promise<SQLIndex[]>
    sqlGetTableTriggers: (schema: string, table: string) => Promise<SQLTriggerInfo[]>
    sqlGetObjectDDL: (schema: string, objectName: string, objectType: string) => Promise<string>
    sqlGetTableRowCount: (schema: string, table: string) => Promise<number>
    sqlDescribeObject: (schema: string, name: string) => Promise<SQLObjectDescription>
    sqlGetTableGrants: (schema: string, table: string) => Promise<SQLGrant[]>
    sqlGetSchemaColumnMap: (schema: string) => Promise<Record<string, string[]>>
    sqlGetHistory: () => Promise<SQLHistoryEntry[]>
    sqlClearHistory: () => Promise<void>
    sqlGetSavedQueries: () => Promise<SQLSavedQuery[]>
    sqlSaveQuery: (query: SQLSavedQuery) => Promise<void>
    sqlDeleteSavedQuery: (id: string) => Promise<void>
    subscribeSQLConnectionState: (callback: (state: SQLConnectionState) => void) => () => void
    // MongoDB API
    mongoGetConnections: () => Promise<MongoConnectionConfig[]>
    mongoGetActiveConnectionId: () => Promise<string | null>
    mongoSaveConnection: (config: MongoConnectionConfig) => Promise<void>
    mongoDeleteConnection: (id: string) => Promise<void>
    mongoTestConnection: (id: string) => Promise<MongoConnectionState>
    mongoSetActiveConnection: (id: string) => Promise<void>
    mongoDisconnect: () => Promise<void>
    mongoGetDatabases: () => Promise<MongoDatabase[]>
    mongoCreateDatabase: (dbName: string, collectionName: string) => Promise<void>
    mongoDropDatabase: (dbName: string) => Promise<void>
    mongoGetCollections: (database: string) => Promise<MongoCollection[]>
    mongoCreateCollection: (database: string, name: string) => Promise<void>
    mongoDropCollection: (database: string, name: string) => Promise<void>
    mongoRenameCollection: (database: string, oldName: string, newName: string) => Promise<void>
    mongoGetCollectionStats: (database: string, collection: string) => Promise<MongoCollectionStats>
    mongoFindDocuments: (database: string, collection: string, options: MongoQueryOptions) => Promise<MongoQueryResult>
    mongoFindDocumentById: (database: string, collection: string, id: string) => Promise<MongoDocument | null>
    mongoInsertDocument: (database: string, collection: string, document: Record<string, unknown>) => Promise<string>
    mongoUpdateDocument: (database: string, collection: string, id: string, update: Record<string, unknown>) => Promise<void>
    mongoDeleteDocument: (database: string, collection: string, id: string) => Promise<void>
    mongoInsertMany: (database: string, collection: string, documents: Record<string, unknown>[]) => Promise<number>
    mongoDeleteMany: (database: string, collection: string, filter: Record<string, unknown>) => Promise<number>
    mongoExplainQuery: (database: string, collection: string, options: MongoQueryOptions) => Promise<MongoExplainResult>
    mongoRunAggregation: (database: string, collection: string, pipeline: MongoAggregationStage[]) => Promise<MongoAggregationResult>
    mongoAnalyzeSchema: (database: string, collection: string, sampleSize?: number) => Promise<MongoSchemaField[]>
    mongoGetIndexes: (database: string, collection: string) => Promise<MongoIndex[]>
    mongoCreateIndex: (database: string, collection: string, options: MongoCreateIndexOptions) => Promise<string>
    mongoDropIndex: (database: string, collection: string, indexName: string) => Promise<void>
    mongoGetValidationRules: (database: string, collection: string) => Promise<MongoValidationRules | null>
    mongoSetValidationRules: (database: string, collection: string, rules: MongoValidationRules) => Promise<void>
    mongoExportCollection: (database: string, collection: string, format: 'json' | 'jsonl' | 'csv', options?: MongoQueryOptions) => Promise<void>
    mongoImportDocuments: (database: string, collection: string) => Promise<number>
    mongoGetSavedQueries: () => Promise<MongoSavedQuery[]>
    mongoSaveQuery: (query: MongoSavedQuery) => Promise<void>
    mongoDeleteSavedQuery: (id: string) => Promise<void>
    subscribeMongoConnectionState: (callback: (state: MongoConnectionState) => void) => () => void
    // AI Automation API
    aiGetTasks: () => Promise<AITask[]>
    aiCreateTask: (title: string, description: string, projects: AITaskProject[], boardId?: string) => Promise<AITask>
    aiSelectDirectory: () => Promise<string | null>
    aiAttachTaskFiles: (taskId: string, filePaths: string[]) => Promise<string[]>
    aiDeleteTaskAttachment: (taskId: string, filename: string) => Promise<void>
    aiDeleteAgentFile: (taskId: string, filename: string) => Promise<void>
    aiToggleFileExclusion: (taskId: string, filename: string) => Promise<void>
    aiListTaskAttachments: (taskId: string) => Promise<string[]>
    aiSelectFiles: () => Promise<string[] | null>
    aiUpdateTask: (id: string, updates: Partial<AITask>) => Promise<void>
    aiDeleteTask: (id: string) => Promise<void>
    aiMoveTaskPhase: (id: string, targetPhase: string) => Promise<void>
    aiGetTaskFiles: (taskId: string) => Promise<string[]>
    aiReadTaskFile: (taskId: string, filename: string) => Promise<string>
    aiReadContextHistory: (contextHistoryPath: string) => Promise<{ prompt: string; events: string }>
    aiStopTask: (id: string) => Promise<void>
    aiSendTaskInput: (taskId: string, input: string) => Promise<void>
    aiGetTaskOutputHistory: (taskId: string) => Promise<string[]>
    aiGetAgentStats: (taskId: string) => Promise<AIAgentStats | null>
    aiGetTaskDiff: (taskId: string) => Promise<AIProjectDiff[]>
    aiOpenTaskDir: (taskId: string) => Promise<void>
    aiCreateTaskServices: (taskId: string) => Promise<DirectorySettings[]>
    aiCleanupTaskServices: (taskId: string) => Promise<void>
    aiRemoveWorktree: (taskId: string) => Promise<void>
    aiSendPlannerMessage: (conversation: { role: 'user' | 'assistant'; content: string }[], cwd: string) => Promise<string>
    aiSavePlannerConversation: (sessionId: string, messages: { role: 'user' | 'assistant'; content: string }[], debugEvents: { type: string; [key: string]: unknown }[]) => Promise<string>
    subscribeAIPlannerChunk: (callback: (chunk: string) => void) => () => void
    subscribeAIPlannerDebug: (callback: (event: unknown) => void) => () => void
    aiGetSettings: () => Promise<AIAutomationSettings>
    aiUpdateSettings: (updates: Partial<AIAutomationSettings>) => Promise<void>
    aiGenerateKnowledgeDoc: (projectPath: string) => Promise<AIKnowledgeDoc>
    aiGetBranchInfo: (taskId: string) => Promise<AIBranchInfo[]>
    aiRenameBranch: (taskId: string, worktreePath: string, newBranchName: string, pushToRemote: boolean) => Promise<void>
    aiEditCommitMessage: (worktreePath: string, commitHash: string, newMessage: string, pushToRemote: boolean) => Promise<void>
    aiEditMultipleCommitMessages: (worktreePath: string, edits: { hash: string; newMessage: string }[], pushToRemote: boolean) => Promise<void>
    aiSquashCommits: (worktreePath: string, baseBranch: string, newMessage: string, pushToRemote: boolean) => Promise<void>
    subscribeAITasks: (callback: (tasks: AITask[]) => void) => () => void
    subscribeAITaskOutput: (callback: (data: AITaskOutput) => void) => () => void
    subscribeAIAgentStats: (callback: (data: AIAgentStats) => void) => () => void
    subscribeAINotifications: (callback: (data: AINotification[]) => void) => () => void
    aiGetNotifications: () => Promise<AINotification[]>
    aiMarkNotificationsRead: () => Promise<void>
    subscribeAISettings: (callback: (settings: AIAutomationSettings) => void) => () => void
  }
}
