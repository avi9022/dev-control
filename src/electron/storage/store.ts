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

export const DEFAULT_PIPELINE: AIPipelinePhase[] = [
  {
    id: 'planning',
    name: 'Planning',
    type: 'agent',
    prompt: `You are a planning agent. Your ONLY job is to produce an implementation plan. You must NOT implement, create, modify, or delete any files. Do NOT execute any code or make any changes. You are strictly a planner.

Your job:
1. Understand the task described below
2. Explore the relevant codebases to understand the current state (read-only)
3. Produce a detailed implementation plan

Save your plan to plan.md in the task directory provided via --add-dir. Be specific about:
- Which files need to be created or modified
- What changes need to be made in each file
- What the expected outcome is
- Any risks or considerations

IMPORTANT: Do NOT take any action. Do NOT create or modify project files. ONLY explore and write the plan.`,
    roles: ['planner', 'git'],
    color: '#6B7FD7',
  },
  {
    id: 'in-progress',
    name: 'In Progress',
    type: 'agent',
    prompt: `You are an implementation agent. Your job is to:
1. Read the plan from plan.md in the task directory
2. Implement the changes described in the plan
3. Create commits for your work
4. Ask for help if you get stuck

Work methodically through the plan step by step.`,
    roles: ['worker', 'git'],
    color: '#4DA870',
  },
  {
    id: 'agent-review',
    name: 'Agent Review',
    type: 'agent',
    prompt: `You are a code review agent. Your job is to:
1. Read the plan from plan.md in the task directory
2. Review the code changes against the plan and requirements
3. Check for bugs, security issues, and code quality
4. Provide specific, actionable feedback

Save your review to review.md in the task directory.

At the end of your review, you MUST output one of:
- REVIEW_DECISION: APPROVE — if the changes are acceptable
- REVIEW_DECISION: REJECT — if changes need work, followed by your comments`,
    roles: ['reviewer', 'git'],
    rejectPattern: 'REVIEW_DECISION: REJECT',
    rejectTarget: 'in-progress',
    color: '#D4A843',
  },
  {
    id: 'human-review',
    name: 'Human Review',
    type: 'manual',
    color: '#9B6DC6',
  },
]

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
      defaultGitStrategy: 'worktree' as AIGitStrategy,
      defaultBaseBranch: 'main',
      pipeline: DEFAULT_PIPELINE,
      phasePrompts: {
        planning: '',
        working: '',
        reviewing: ''
      },
      globalRules: '',
      knowledgeDocs: [],
      stallTimeoutMinutes: 3
    }
  },
});

export { DEFAULT_BROKER_CONFIGS, DEFAULT_DYNAMODB_CONNECTION }
