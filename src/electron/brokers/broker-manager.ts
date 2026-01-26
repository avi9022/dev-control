import { BrowserWindow } from "electron"
import type { BrokerClient, BrokerConfig, BrokerConnectionState, BrokerType } from "./types.js"
import { DEFAULT_BROKER_CONFIGS } from "./types.js"
import { ElasticMQClient } from "./elasticmq/client.js"
import { RabbitMQClient } from "./rabbitmq/client.js"
import { store } from "../storage/store.js"
import { ipcWebContentsSend } from "../utils/ipc-handle.js"

class BrokerManager {
  private clients: Map<BrokerType, BrokerClient> = new Map()
  private activeBrokerType: BrokerType
  private connectionState: BrokerConnectionState | null = null
  private mainWindow: BrowserWindow | null = null

  constructor() {
    this.activeBrokerType = store.get('activeBroker') || 'elasticmq'
    this.initializeClients()
  }

  private initializeClients(): void {
    const configs = store.get('brokerConfigs') || DEFAULT_BROKER_CONFIGS

    this.clients.set('elasticmq', new ElasticMQClient(configs.elasticmq))
    this.clients.set('rabbitmq', new RabbitMQClient(configs.rabbitmq))
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  getActiveClient(): BrokerClient {
    const client = this.clients.get(this.activeBrokerType)
    if (!client) {
      throw new Error(`No client found for broker type: ${this.activeBrokerType}`)
    }
    return client
  }

  getActiveBrokerType(): BrokerType {
    return this.activeBrokerType
  }

  async setActiveBroker(type: BrokerType): Promise<void> {
    this.activeBrokerType = type
    store.set('activeBroker', type)
    await this.testConnection()
  }

  getBrokerConfigs(): BrokerConfig[] {
    const configs = store.get('brokerConfigs') || DEFAULT_BROKER_CONFIGS
    return Object.values(configs)
  }

  saveBrokerConfig(config: BrokerConfig): void {
    const configs = store.get('brokerConfigs') || DEFAULT_BROKER_CONFIGS
    const updatedConfigs = {
      ...configs,
      [config.type]: config
    }
    store.set('brokerConfigs', updatedConfigs)

    const client = this.clients.get(config.type)
    if (client && 'updateConfig' in client) {
      (client as ElasticMQClient | RabbitMQClient).updateConfig(config)
    }
  }

  async testConnection(type?: BrokerType): Promise<BrokerConnectionState> {
    const brokerType = type || this.activeBrokerType
    const client = this.clients.get(brokerType)

    if (!client) {
      const errorState: BrokerConnectionState = {
        type: brokerType,
        isConnected: false,
        lastError: 'Client not initialized',
        lastChecked: Date.now()
      }
      this.emitConnectionState(errorState)
      return errorState
    }

    const state = await client.testConnection()

    if (brokerType === this.activeBrokerType) {
      this.connectionState = state
      this.emitConnectionState(state)
    }

    return state
  }

  private emitConnectionState(state: BrokerConnectionState): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      ipcWebContentsSend('brokerConnectionState', this.mainWindow.webContents, state)
    }
  }

  getConnectionState(): BrokerConnectionState | null {
    return this.connectionState
  }

  isConnected(): boolean {
    return this.connectionState?.isConnected ?? false
  }

  async listQueues(): Promise<string[]> {
    if (!this.isConnected()) return []
    return this.getActiveClient().listQueues()
  }

  async createQueue(name: string, options?: CreateQueueOptions): Promise<string | undefined> {
    return this.getActiveClient().createQueue(name, options)
  }

  async deleteQueue(queueUrl: string): Promise<void> {
    return this.getActiveClient().deleteQueue(queueUrl)
  }

  async purgeQueue(queueUrl: string): Promise<void> {
    return this.getActiveClient().purgeQueue(queueUrl)
  }

  async purgeAllQueues(): Promise<void> {
    const queues = await this.listQueues()
    await Promise.all(queues.map(queueUrl => this.purgeQueue(queueUrl)))
  }

  async sendMessage(queueUrl: string, message: string): Promise<void> {
    return this.getActiveClient().sendMessage(queueUrl, message)
  }

  async getQueueData(queueUrl: string): Promise<QueueData> {
    return this.getActiveClient().getQueueData(queueUrl)
  }
}

export const brokerManager = new BrokerManager()
