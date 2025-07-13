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
};

interface Window {
  electron: {
    getDirectories: () => Promise<DirectorySettings[]>
    subscribeDirectories: (callback: (directories: DirectorySettings[]) => void) => void
    subscribeLogs: (callback: (log: Log) => void) => void
    addDirectoriesFromFolder: () => Promise<void>
    updateDirectory: (id: string, data: DataToUpdate) => void
    removeDirectory: (id?: string) => void
    runService: (id: string) => void
    openProjectInBrowser: (id: string) => void
    stopService: (id: string) => void
    checkServiceState: (id: string) => Promise<DirectoryState>
    subscribeDirectoriesState: (callback: (statesMap: DirectoryMapByState) => void) => void
    subscribeQueuesList: (callback: (list: string[]) => void) => void
    subscribeQueueData: (callback: (res: { queueUrl: string, data: QueueData }) => void) => void
    getQueues: (id: string) => Promise<QueueSettings[]>
    pollQueue: (urk: string) => void
    sendQueueMessage: (queueUrl: string, message: string) => void
    purgeQueue: (queueUrl: string) => void
    deleteQueue: (queueUrl: string) => void
    createQueue: (name: string, options: CreateQueueOptions) => void
    getQueueData: (queueUrl: string) => Promise<QueueData>
    stopPollingQueue: (queueUrl: string) => Promise<boolean>
  }
}