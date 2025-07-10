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
  attributes?: Partial<Record<MessageSystemAttributeName, string>>
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
  sendQueueMessage: {
    return: void;
    args: [string, string];
  };
  purgeQueue: {
    return: void;
    args: [string];
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
    getQueues: (id: string) => Promise<QueueSettings[]>
    sendQueueMessage: (queueUrl: string, message: string) => void
    purgeQueue: (queueUrl: string) => void
    getQueueData: (queueUrl: string) => Promise<QueueData>
  }
}