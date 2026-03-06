import Store from 'electron-store';

type Schema = {
  directories: DirectorySettings[];
  workflows: Workflow[]
  archivedMessages: QueueMessageMapByQueue
  updateNotificationSettings: UpdateNotificationSettings
  waitingMessagesCache: Record<string, {
    createdAt: number,
    messages: QueueMessage[]
  }>
  todoFolderPath: string | undefined
  todoSettings: {
    autoHide: boolean
    opacity: number
    bgColor: string
    shortcut: string
  }
  // Broker settings
  activeBroker: BrokerType
  brokerConfigs: Record<BrokerType, BrokerConfig>
  // DynamoDB connection settings
  dynamodbConnections: DynamoDBConnectionConfig[]
  activeDynamoDBConnection: string | null
  // API Client settings
  apiWorkspaces: ApiWorkspace[]
  activeApiWorkspaceId: string | null
  apiHistory: ApiHistoryEntry[]
  apiGlobalVariables: ApiVariable[]
  // Docker settings
  dockerSettings: {
    refreshInterval: number
    showAllContainers: boolean
    defaultContext: string | null
    statsEnabled: boolean
    logTimestamps: boolean
    pruneConfirmation: boolean
  }
  dockerFavoriteContainers: string[]
  // MongoDB settings
  mongoConnections: MongoConnectionConfig[]
  activeMongoConnectionId: string | null
  mongoSavedQueries: MongoSavedQuery[]
  mongoSettings: {
    maxDocumentsPerPage: number
    defaultView: 'list' | 'json' | 'table'
    autoSchema: boolean
    maxSchemaAnalysisDocs: number
    queryTimeout: number
  }
  mongoRecentDatabases: Record<string, string>
  // AI Automation settings
  aiTasks: AITask[]
  aiAutomationSettings: AIAutomationSettings
};

const DEFAULT_DYNAMODB_CONNECTION: DynamoDBConnectionConfig = {
  id: 'default-local',
  name: 'Local',
  connectionMethod: 'custom-endpoint',
  region: 'eu-west-1',
  endpoint: 'http://localhost:8000',
  accessKeyId: 'root',
  secretAccessKey: 'root'
}

const DEFAULT_BROKER_CONFIGS: Record<BrokerType, BrokerConfig> = {
  elasticmq: {
    type: 'elasticmq',
    host: 'localhost',
    port: 9324,
    username: 'root',
    password: 'root',
    useHttps: false
  },
  rabbitmq: {
    type: 'rabbitmq',
    host: 'localhost',
    port: 15671,
    username: 'user',
    password: 'bitnami',
    useHttps: true
  }
}

export const store = new Store<Schema>({
  defaults: {
    directories: [],
    workflows: [],
    archivedMessages: {},
    waitingMessagesCache: {},
    updateNotificationSettings: {
      hasUpdates: false,
      userRefusedUpdates: false,
      userWasPrompted: false
    },
    todoFolderPath: undefined,
    todoSettings: {
      autoHide: false,
      opacity: 10,
      bgColor: '#ffffff',
      shortcut: 'CommandOrControl+Shift+T'
    },
    activeBroker: 'elasticmq',
    brokerConfigs: DEFAULT_BROKER_CONFIGS,
    dynamodbConnections: [DEFAULT_DYNAMODB_CONNECTION],
    activeDynamoDBConnection: 'default-local',
    // API Client defaults
    apiWorkspaces: [],
    activeApiWorkspaceId: null,
    apiHistory: [],
    apiGlobalVariables: [],
    // Docker defaults
    dockerSettings: {
      refreshInterval: 3000,
      showAllContainers: true,
      defaultContext: null,
      statsEnabled: true,
      logTimestamps: true,
      pruneConfirmation: true
    },
    dockerFavoriteContainers: [],
    // MongoDB defaults
    mongoConnections: [],
    activeMongoConnectionId: null,
    mongoSavedQueries: [],
    mongoSettings: {
      maxDocumentsPerPage: 50,
      defaultView: 'list',
      autoSchema: true,
      maxSchemaAnalysisDocs: 1000,
      queryTimeout: 30000
    },
    mongoRecentDatabases: {},
    // AI Automation defaults
    aiTasks: [],
    aiAutomationSettings: {
      maxConcurrency: 1,
      defaultMaxReviewCycles: 3,
      defaultGitStrategy: 'branch' as AIGitStrategy,
      phasePrompts: {
        planning: '',
        working: '',
        reviewing: ''
      },
      globalRules: '',
      knowledgeDocs: []
    }
  },
});

export { DEFAULT_BROKER_CONFIGS, DEFAULT_DYNAMODB_CONNECTION }
