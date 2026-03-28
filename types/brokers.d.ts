// Broker Types
type BrokerType = 'elasticmq' | 'rabbitmq'

interface BrokerConfig {
  type: BrokerType
  host: string
  port: number
  username: string
  password: string
  useHttps: boolean
}

interface BrokerConnectionState {
  type: BrokerType
  isConnected: boolean
  lastError?: string
  lastChecked?: number
}
