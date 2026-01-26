interface DirectorySettings {
  id: string
  customLabel?: string;
  path: string
  name: string
  isInitializing?: boolean
  port?: string
  packageJsonExists: boolean
  isFrontendProj: boolean
  runCommand?: string
}

interface QueueMessage {
  id: string
  queueUrl: string
  createdAt: number
  message: string
  receiptHandle?: string,
  attributes?: {
    AWSTraceHeader?: string
    All?: string
    ApproximateFirstReceiveTimestamp?: string
    ApproximateReceiveCount?: string
    DeadLetterQueueSourceArn?: string
    MessageDeduplicationId?: string
    MessageGroupId?: string
    SenderId?: string
    SentTimestamp?: string
    SequenceNumber?: string
  }
}

type QueueMessageMapByQueue = Record<string, QueueMessage[]>

interface QueueSettings {
  funcName: string
  funcAlias: string
  offlineSqsEndpoint: string
}

interface DataToUpdate {
  name?: string
  port?: string
  runCommand?: string
  isInitializing?: boolean
}

type DirectoryMapByState = Record<string, DirectoryState>
type DirectoryState = 'RUNNING' | 'UNKNOWN' | 'STOPPED' | 'INITIALIZING'

interface Log {
  dirId: string
  line: string
}

interface CreateQueueOptions {
  delaySeconds?: number;                  // Default delay for messages
  visibilityTimeout?: number;            // Time a message is invisible after being received
  messageRetentionPeriod?: number;       // How long to keep messages (in seconds)
  maxMessageSize?: number;               // Max size in bytes (1024 - 262144)
  receiveMessageWaitTimeSeconds?: number; // For long polling
  fifoQueue?: boolean;                   // True for FIFO queue
  contentBasedDeduplication?: boolean;   // Auto deduplication (FIFO only)
  deadLetterTargetArn?: string;          // DLQ target
  maxReceiveCount?: number;              // For DLQ redrive policy
  tags?: Record<string, string>;         // Optional metadata tags
}

interface QueueData {
  lastFiveMessages: QueueMessage[],
  waitingMessages: QueueMessage[],
  queueAttributes: Partial<Record<QueueAttributeName, string>>
}

interface Workflow {
  name: string
  id: string
  services: string[]
}

interface UpdateNotificationSettings {
  hasUpdates: boolean
  userWasPrompted: boolean
  userRefusedUpdates: boolean
}

type TodoPriority = 'none' | 'low' | 'medium' | 'high'

interface Todo {
  id: string
  text: string
  completed: boolean
  createdAt: string
  priority?: TodoPriority
}

interface TodoSettings {
  autoHide: boolean
}

interface ImportantValue {
  id: string
  key: string
  value: string
}

// DynamoDB types
interface DynamoDBTableInfo {
  tableName: string
  tableStatus: string
  itemCount: number
  tableSizeBytes: number
  creationDateTime?: Date
  keySchema: Array<{
    attributeName: string
    keyType: 'HASH' | 'RANGE'
  }>
  attributeDefinitions: Array<{
    attributeName: string
    attributeType: 'S' | 'N' | 'B'
  }>
  globalSecondaryIndexes?: Array<{
    indexName: string
    keySchema: Array<{
      attributeName: string
      keyType: 'HASH' | 'RANGE'
    }>
  }>
  localSecondaryIndexes?: Array<{
    indexName: string
    keySchema: Array<{
      attributeName: string
      keyType: 'HASH' | 'RANGE'
    }>
  }>
}

interface DynamoDBScanOptions {
  limit?: number
  exclusiveStartKey?: Record<string, unknown>
  filterExpression?: string
  expressionAttributeNames?: Record<string, string>
  expressionAttributeValues?: Record<string, unknown>
}

type DynamoDBSKOperator = '=' | '<' | '<=' | '>' | '>=' | 'begins_with' | 'between'

interface DynamoDBQueryOptions {
  indexName?: string
  pkValue: string | number
  pkName: string
  skName?: string
  skValue?: string | number
  skValue2?: string | number
  skOperator?: DynamoDBSKOperator
  limit?: number
  exclusiveStartKey?: Record<string, unknown>
  scanIndexForward?: boolean
  filterExpression?: string
  filterNames?: Record<string, string>
  filterValues?: Record<string, unknown>
}

interface DynamoDBScanResult {
  items: Record<string, unknown>[]
  lastEvaluatedKey?: Record<string, unknown>
  count: number
  scannedCount: number
}

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
    return: Workflow[];
    args: [Workflow[]];
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
    return: Workflow[],
    args: []
  },
  createWorkflow: {
    return: void;
    args: [string, string[]]
  }
  removeWorkflow: {
    return: void;
    args: [string]
  }
  updateWorkflow: {
    return: void;
    args: [string, Omit<Workflow, 'id'>]
  }
  startWorkflow: {
    return: void;
    args: [string]
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
  openInVSCode: {
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
};

interface Window {
  electron: {
    getDirectories: () => Promise<DirectorySettings[]>
    subscribeDirectories: (callback: (directories: DirectorySettings[]) => void) => () => void
    subscribeWorkflows: (callback: (flows: Workflow[]) => void) => () => void
    subscribeUpdateNotificationSettings: (callback: (flows: UpdateNotificationSettings) => void) => () => void
    subscribeLogs: (callback: (log: Log) => void) => () => void
    addDirectoriesFromFolder: () => Promise<void>
    updateDirectory: (id: string, data: DataToUpdate) => void
    removeDirectory: (id?: string) => void
    runService: (id: string) => void
    openProjectInBrowser: (id: string) => void
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
    getWorkflows: () => Promise<Workflow[]>
    createWorkflow: (name: string, services: string[]) => void
    removeWorkflow: (id: string) => void
    updateWorkflow: (id: string, data: Omit<Workflow, 'id'>) => void
    startWorkflow: (id: string) => void
    openInVSCode: (id: string) => void
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
    // DynamoDB API
    dynamodbListTables: () => Promise<string[]>
    dynamodbDescribeTable: (tableName: string) => Promise<DynamoDBTableInfo>
    dynamodbScanTable: (tableName: string, options?: DynamoDBScanOptions) => Promise<DynamoDBScanResult>
    dynamodbQueryTable: (tableName: string, options: DynamoDBQueryOptions) => Promise<DynamoDBScanResult>
    dynamodbGetItem: (tableName: string, key: Record<string, unknown>) => Promise<Record<string, unknown> | null>
    dynamodbPutItem: (tableName: string, item: Record<string, unknown>) => Promise<void>
    dynamodbDeleteItem: (tableName: string, key: Record<string, unknown>) => Promise<void>
  }
}