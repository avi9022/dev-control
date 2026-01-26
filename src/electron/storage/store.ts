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
  }
  // Broker settings
  activeBroker: BrokerType
  brokerConfigs: Record<BrokerType, BrokerConfig>
};

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
      autoHide: false
    },
    activeBroker: 'elasticmq',
    brokerConfigs: DEFAULT_BROKER_CONFIGS
  },
});

export { DEFAULT_BROKER_CONFIGS }
