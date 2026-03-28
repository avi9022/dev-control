export type BrokerType = 'elasticmq' | 'rabbitmq'

export interface BrokerConfig {
  type: BrokerType
  host: string
  port: number
  username: string
  password: string
  useHttps: boolean
}

export interface BrokerConnectionState {
  type: BrokerType
  isConnected: boolean
  lastError?: string
  lastChecked?: number
}

export interface BrokerClient {
  readonly type: BrokerType

  updateConfig(config: BrokerConfig): void

  testConnection(): Promise<BrokerConnectionState>

  listQueues(): Promise<string[]>
  createQueue(name: string, options?: CreateQueueOptions): Promise<string | undefined>
  deleteQueue(queueUrl: string): Promise<void>
  purgeQueue(queueUrl: string): Promise<void>

  sendMessage(queueUrl: string, message: string): Promise<void>
  getQueueData(queueUrl: string): Promise<QueueData>
}

export const DEFAULT_BROKER_CONFIGS: Record<BrokerType, BrokerConfig> = {
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
