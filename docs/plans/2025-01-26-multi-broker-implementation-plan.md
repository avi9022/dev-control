# Multi-Broker Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add RabbitMQ support alongside ElasticMQ with a unified interface, configurable settings UI, and fix connection retry loops.

**Architecture:** Abstract broker operations behind a `BrokerClient` interface. Create separate implementations for ElasticMQ (SQS API) and RabbitMQ (HTTP Management API). BrokerManager singleton handles active broker selection and emits connection state changes.

**Tech Stack:** TypeScript, Electron IPC, React Context, Radix UI components, AWS SDK (ElasticMQ), fetch (RabbitMQ HTTP API)

---

## Phase 1: Types & Store Schema

### Task 1: Add Broker Types to types.d.ts

**Files:**
- Modify: `types.d.ts:86-106` (after TodoSettings, before EventPayloadMapping)

**Step 1: Add the broker type definitions**

Add after line 105 (after ImportantValue interface):

```typescript
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
```

**Step 2: Add IPC event types to EventPayloadMapping**

Add before the closing brace of EventPayloadMapping (around line 318):

```typescript
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
```

**Step 3: Add Window.electron API types**

Add to Window.electron interface (around line 376):

```typescript
    // Broker API
    getBrokerConfigs: () => Promise<BrokerConfig[]>
    saveBrokerConfig: (config: BrokerConfig) => Promise<void>
    getActiveBroker: () => Promise<BrokerType>
    setActiveBroker: (type: BrokerType) => Promise<void>
    testBrokerConnection: (type: BrokerType) => Promise<BrokerConnectionState>
    subscribeBrokerConnectionState: (callback: (state: BrokerConnectionState) => void) => () => void
```

**Step 4: Verify no TypeScript errors**

Run: `npm run transpile:electron`
Expected: No errors

**Step 5: Commit**

```bash
git add types.d.ts
git commit -m "feat(types): add broker configuration types and IPC definitions"
```

---

### Task 2: Update Store Schema

**Files:**
- Modify: `src/electron/storage/store.ts`

**Step 1: Update the Schema type and defaults**

Replace the entire file content:

```typescript
import Store from 'electron-store';

type BrokerType = 'elasticmq' | 'rabbitmq'

interface BrokerConfig {
  type: BrokerType
  host: string
  port: number
  username: string
  password: string
  useHttps: boolean
}

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
```

**Step 2: Verify TypeScript compiles**

Run: `npm run transpile:electron`
Expected: No errors

**Step 3: Commit**

```bash
git add src/electron/storage/store.ts
git commit -m "feat(store): add broker configuration to electron-store schema"
```

---

## Phase 2: Backend Broker Infrastructure

### Task 3: Create Broker Types Module

**Files:**
- Create: `src/electron/brokers/types.ts`

**Step 1: Create the brokers directory**

Run: `mkdir -p src/electron/brokers/elasticmq src/electron/brokers/rabbitmq`

**Step 2: Create types.ts with BrokerClient interface**

```typescript
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
```

**Step 3: Commit**

```bash
git add src/electron/brokers/types.ts
git commit -m "feat(brokers): add BrokerClient interface and shared types"
```

---

### Task 4: Create ElasticMQ Client Implementation

**Files:**
- Create: `src/electron/brokers/elasticmq/client.ts`

**Step 1: Create the ElasticMQ client**

```typescript
import {
  SQSClient,
  ListQueuesCommand,
  CreateQueueCommand,
  DeleteQueueCommand,
  PurgeQueueCommand,
  SendMessageCommand,
  ReceiveMessageCommand,
  GetQueueAttributesCommand,
  QueueAttributeName
} from "@aws-sdk/client-sqs"
import { BrokerClient, BrokerConfig, BrokerConnectionState } from "../types.js"
import { store } from "../../storage/store.js"

export class ElasticMQClient implements BrokerClient {
  readonly type = 'elasticmq' as const
  private client: SQSClient
  private config: BrokerConfig

  constructor(config: BrokerConfig) {
    this.config = config
    this.client = this.createSQSClient(config)
  }

  private createSQSClient(config: BrokerConfig): SQSClient {
    const protocol = config.useHttps ? 'https' : 'http'
    return new SQSClient({
      region: "eu-west-1",
      endpoint: `${protocol}://${config.host}:${config.port}`,
      credentials: {
        accessKeyId: config.username,
        secretAccessKey: config.password,
      },
    })
  }

  updateConfig(config: BrokerConfig): void {
    this.config = config
    this.client = this.createSQSClient(config)
  }

  async testConnection(): Promise<BrokerConnectionState> {
    try {
      await this.client.send(new ListQueuesCommand({}))
      return {
        type: 'elasticmq',
        isConnected: true,
        lastChecked: Date.now()
      }
    } catch (error) {
      return {
        type: 'elasticmq',
        isConnected: false,
        lastError: error instanceof Error ? error.message : 'Connection failed',
        lastChecked: Date.now()
      }
    }
  }

  async listQueues(): Promise<string[]> {
    try {
      const response = await this.client.send(new ListQueuesCommand({}))
      return response.QueueUrls || []
    } catch (error) {
      console.error("ElasticMQ: Error listing queues:", error)
      return []
    }
  }

  async createQueue(name: string, options: CreateQueueOptions = {}): Promise<string | undefined> {
    const isFifo = options.fifoQueue ?? name.endsWith(".fifo")
    const attributes: Record<string, string> = {
      DelaySeconds: String(options.delaySeconds ?? 0),
      VisibilityTimeout: String(options.visibilityTimeout ?? 30),
      MessageRetentionPeriod: String(options.messageRetentionPeriod ?? 345600),
      MaximumMessageSize: String(options.maxMessageSize ?? 262144),
      ReceiveMessageWaitTimeSeconds: String(options.receiveMessageWaitTimeSeconds ?? 0),
    }

    if (isFifo) {
      attributes.FifoQueue = "true"
      attributes.ContentBasedDeduplication = String(options.contentBasedDeduplication ?? true)
    }

    if (options.deadLetterTargetArn && options.maxReceiveCount) {
      attributes.RedrivePolicy = JSON.stringify({
        deadLetterTargetArn: options.deadLetterTargetArn,
        maxReceiveCount: options.maxReceiveCount,
      })
    }

    try {
      const result = await this.client.send(new CreateQueueCommand({
        QueueName: name,
        Attributes: attributes,
        tags: options.tags,
      }))
      return result.QueueUrl
    } catch (error) {
      console.error("ElasticMQ: Failed to create queue:", error)
      return undefined
    }
  }

  async deleteQueue(queueUrl: string): Promise<void> {
    try {
      await this.client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }))
    } catch (error) {
      console.error("ElasticMQ: Failed to delete queue:", error)
    }
  }

  async purgeQueue(queueUrl: string): Promise<void> {
    try {
      await this.client.send(new PurgeQueueCommand({ QueueUrl: queueUrl }))
    } catch (error) {
      console.error("ElasticMQ: Failed to purge queue:", error)
    }
  }

  async sendMessage(queueUrl: string, message: string): Promise<void> {
    try {
      await this.client.send(new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: message,
      }))
      this.archiveMessage(queueUrl, message)
    } catch (error) {
      console.error("ElasticMQ: Failed to send message:", error)
    }
  }

  private archiveMessage(queueUrl: string, message: string): void {
    const archived = store.get('archivedMessages') || {}
    const queueMessages = archived[queueUrl] || []
    const newMessage: QueueMessage = {
      id: crypto.randomUUID(),
      queueUrl,
      createdAt: Date.now(),
      message
    }
    archived[queueUrl] = [newMessage, ...queueMessages].slice(0, 5)
    store.set('archivedMessages', archived)
  }

  async getQueueData(queueUrl: string): Promise<QueueData> {
    const [attributes, waitingMessages, lastFiveMessages] = await Promise.all([
      this.getQueueAttributes(queueUrl),
      this.getWaitingMessages(queueUrl),
      this.getArchivedMessages(queueUrl)
    ])

    return {
      queueAttributes: attributes,
      waitingMessages,
      lastFiveMessages
    }
  }

  private async getQueueAttributes(queueUrl: string): Promise<Partial<Record<QueueAttributeName, string>>> {
    try {
      const response = await this.client.send(new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ['All']
      }))
      return response.Attributes || {}
    } catch (error) {
      console.error("ElasticMQ: Failed to get queue attributes:", error)
      return {}
    }
  }

  private async getWaitingMessages(queueUrl: string): Promise<QueueMessage[]> {
    const messages: QueueMessage[] = []
    const MAX_TRIES = 3
    let currentTry = 0

    try {
      while (currentTry < MAX_TRIES) {
        const response = await this.client.send(new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 0,
          VisibilityTimeout: 0,
          AttributeNames: ['All']
        }))

        const received = response.Messages || []
        if (received.length === 0) break

        for (const msg of received) {
          if (!messages.some(m => m.id === msg.MessageId)) {
            messages.push({
              id: msg.MessageId || crypto.randomUUID(),
              queueUrl,
              createdAt: Date.now(),
              message: msg.Body || '',
              receiptHandle: msg.ReceiptHandle,
              attributes: msg.Attributes as QueueMessage['attributes']
            })
          }
        }
        currentTry++
      }
    } catch (error) {
      console.error("ElasticMQ: Failed to get waiting messages:", error)
    }

    return messages
  }

  private getArchivedMessages(queueUrl: string): QueueMessage[] {
    const archived = store.get('archivedMessages') || {}
    return archived[queueUrl] || []
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run transpile:electron`
Expected: No errors

**Step 3: Commit**

```bash
git add src/electron/brokers/elasticmq/client.ts
git commit -m "feat(elasticmq): implement BrokerClient for ElasticMQ/SQS"
```

---

### Task 5: Create RabbitMQ Client Implementation

**Files:**
- Create: `src/electron/brokers/rabbitmq/client.ts`

**Step 1: Create the RabbitMQ client**

```typescript
import { BrokerClient, BrokerConfig, BrokerConnectionState } from "../types.js"
import { store } from "../../storage/store.js"

export class RabbitMQClient implements BrokerClient {
  readonly type = 'rabbitmq' as const
  private config: BrokerConfig
  private baseUrl: string
  private authHeader: string

  constructor(config: BrokerConfig) {
    this.config = config
    this.baseUrl = this.buildBaseUrl(config)
    this.authHeader = this.buildAuthHeader(config)
  }

  private buildBaseUrl(config: BrokerConfig): string {
    const protocol = config.useHttps ? 'https' : 'http'
    return `${protocol}://${config.host}:${config.port}/api`
  }

  private buildAuthHeader(config: BrokerConfig): string {
    return 'Basic ' + Buffer.from(`${config.username}:${config.password}`).toString('base64')
  }

  updateConfig(config: BrokerConfig): void {
    this.config = config
    this.baseUrl = this.buildBaseUrl(config)
    this.authHeader = this.buildAuthHeader(config)
  }

  private async fetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`
    return fetch(url, {
      ...options,
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
  }

  async testConnection(): Promise<BrokerConnectionState> {
    try {
      const response = await this.fetch('/overview')
      if (response.ok) {
        return {
          type: 'rabbitmq',
          isConnected: true,
          lastChecked: Date.now()
        }
      }
      return {
        type: 'rabbitmq',
        isConnected: false,
        lastError: `HTTP ${response.status}: ${response.statusText}`,
        lastChecked: Date.now()
      }
    } catch (error) {
      return {
        type: 'rabbitmq',
        isConnected: false,
        lastError: error instanceof Error ? error.message : 'Connection failed',
        lastChecked: Date.now()
      }
    }
  }

  async listQueues(): Promise<string[]> {
    try {
      const response = await this.fetch('/queues')
      if (!response.ok) return []

      const queues = await response.json() as Array<{ name: string; vhost: string }>
      return queues.map(q => this.buildQueueUrl(q.vhost, q.name))
    } catch (error) {
      console.error("RabbitMQ: Error listing queues:", error)
      return []
    }
  }

  private buildQueueUrl(vhost: string, name: string): string {
    const encodedVhost = encodeURIComponent(vhost)
    return `rabbitmq://${this.config.host}:${this.config.port}/${encodedVhost}/${name}`
  }

  private parseQueueUrl(queueUrl: string): { vhost: string; name: string } {
    const parts = queueUrl.replace('rabbitmq://', '').split('/')
    return {
      vhost: decodeURIComponent(parts[1] || '%2F'),
      name: parts[2] || ''
    }
  }

  async createQueue(name: string, options: CreateQueueOptions = {}): Promise<string | undefined> {
    const vhost = '%2F' // default vhost
    try {
      const body: Record<string, unknown> = {
        durable: true,
        auto_delete: false,
      }

      if (options.deadLetterTargetArn) {
        body.arguments = {
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': options.deadLetterTargetArn,
        }
      }

      const response = await this.fetch(`/queues/${vhost}/${encodeURIComponent(name)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })

      if (response.ok || response.status === 204) {
        return this.buildQueueUrl(decodeURIComponent(vhost), name)
      }
      console.error("RabbitMQ: Failed to create queue:", response.statusText)
      return undefined
    } catch (error) {
      console.error("RabbitMQ: Failed to create queue:", error)
      return undefined
    }
  }

  async deleteQueue(queueUrl: string): Promise<void> {
    const { vhost, name } = this.parseQueueUrl(queueUrl)
    try {
      await this.fetch(`/queues/${encodeURIComponent(vhost)}/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      })
    } catch (error) {
      console.error("RabbitMQ: Failed to delete queue:", error)
    }
  }

  async purgeQueue(queueUrl: string): Promise<void> {
    const { vhost, name } = this.parseQueueUrl(queueUrl)
    try {
      await this.fetch(`/queues/${encodeURIComponent(vhost)}/${encodeURIComponent(name)}/contents`, {
        method: 'DELETE',
      })
    } catch (error) {
      console.error("RabbitMQ: Failed to purge queue:", error)
    }
  }

  async sendMessage(queueUrl: string, message: string): Promise<void> {
    const { vhost, name } = this.parseQueueUrl(queueUrl)
    try {
      const response = await this.fetch(`/exchanges/${encodeURIComponent(vhost)}/amq.default/publish`, {
        method: 'POST',
        body: JSON.stringify({
          routing_key: name,
          payload: message,
          payload_encoding: 'string',
          properties: {},
        }),
      })

      if (response.ok) {
        this.archiveMessage(queueUrl, message)
      }
    } catch (error) {
      console.error("RabbitMQ: Failed to send message:", error)
    }
  }

  private archiveMessage(queueUrl: string, message: string): void {
    const archived = store.get('archivedMessages') || {}
    const queueMessages = archived[queueUrl] || []
    const newMessage: QueueMessage = {
      id: crypto.randomUUID(),
      queueUrl,
      createdAt: Date.now(),
      message
    }
    archived[queueUrl] = [newMessage, ...queueMessages].slice(0, 5)
    store.set('archivedMessages', archived)
  }

  async getQueueData(queueUrl: string): Promise<QueueData> {
    const { vhost, name } = this.parseQueueUrl(queueUrl)

    const [queueInfo, waitingMessages] = await Promise.all([
      this.getQueueInfo(vhost, name),
      this.getWaitingMessages(vhost, name, queueUrl),
    ])

    return {
      queueAttributes: this.mapToSQSAttributes(queueInfo),
      waitingMessages,
      lastFiveMessages: this.getArchivedMessages(queueUrl)
    }
  }

  private async getQueueInfo(vhost: string, name: string): Promise<Record<string, unknown>> {
    try {
      const response = await this.fetch(`/queues/${encodeURIComponent(vhost)}/${encodeURIComponent(name)}`)
      if (!response.ok) return {}
      return await response.json()
    } catch (error) {
      console.error("RabbitMQ: Failed to get queue info:", error)
      return {}
    }
  }

  private mapToSQSAttributes(info: Record<string, unknown>): Partial<Record<string, string>> {
    return {
      ApproximateNumberOfMessages: String(info.messages ?? 0),
      ApproximateNumberOfMessagesNotVisible: String(info.messages_unacknowledged ?? 0),
      CreatedTimestamp: String(Math.floor(Date.now() / 1000)),
      LastModifiedTimestamp: String(Math.floor(Date.now() / 1000)),
    }
  }

  private async getWaitingMessages(vhost: string, name: string, queueUrl: string): Promise<QueueMessage[]> {
    try {
      const response = await this.fetch(`/queues/${encodeURIComponent(vhost)}/${encodeURIComponent(name)}/get`, {
        method: 'POST',
        body: JSON.stringify({
          count: 10,
          ackmode: 'ack_requeue_true',
          encoding: 'auto',
        }),
      })

      if (!response.ok) return []

      const messages = await response.json() as Array<{
        message_count: number
        payload: string
        properties: Record<string, unknown>
      }>

      return messages.map((msg, index) => ({
        id: crypto.randomUUID(),
        queueUrl,
        createdAt: Date.now(),
        message: msg.payload,
      }))
    } catch (error) {
      console.error("RabbitMQ: Failed to get waiting messages:", error)
      return []
    }
  }

  private getArchivedMessages(queueUrl: string): QueueMessage[] {
    const archived = store.get('archivedMessages') || {}
    return archived[queueUrl] || []
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run transpile:electron`
Expected: No errors

**Step 3: Commit**

```bash
git add src/electron/brokers/rabbitmq/client.ts
git commit -m "feat(rabbitmq): implement BrokerClient for RabbitMQ Management API"
```

---

### Task 6: Create Broker Manager

**Files:**
- Create: `src/electron/brokers/broker-manager.ts`

**Step 1: Create the BrokerManager singleton**

```typescript
import { BrowserWindow } from "electron"
import { BrokerClient, BrokerConfig, BrokerConnectionState, BrokerType } from "./types.js"
import { ElasticMQClient } from "./elasticmq/client.js"
import { RabbitMQClient } from "./rabbitmq/client.js"
import { store, DEFAULT_BROKER_CONFIGS } from "../storage/store.js"
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
    configs[config.type] = config
    store.set('brokerConfigs', configs)

    // Update the client with new config
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

  // Delegate methods to active client
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

  async sendMessage(queueUrl: string, message: string): Promise<void> {
    return this.getActiveClient().sendMessage(queueUrl, message)
  }

  async getQueueData(queueUrl: string): Promise<QueueData> {
    return this.getActiveClient().getQueueData(queueUrl)
  }
}

export const brokerManager = new BrokerManager()
```

**Step 2: Export from index file**

Create `src/electron/brokers/index.ts`:

```typescript
export { brokerManager } from './broker-manager.js'
export { BrokerClient, BrokerConfig, BrokerConnectionState, BrokerType, DEFAULT_BROKER_CONFIGS } from './types.js'
```

**Step 3: Verify TypeScript compiles**

Run: `npm run transpile:electron`
Expected: No errors

**Step 4: Commit**

```bash
git add src/electron/brokers/
git commit -m "feat(brokers): add BrokerManager singleton for unified broker access"
```

---

## Phase 3: Wire Up IPC Handlers

### Task 7: Update main.ts with Broker IPC Handlers

**Files:**
- Modify: `src/electron/main.ts`

**Step 1: Add imports at top of file**

Add after existing imports:

```typescript
import { brokerManager } from './brokers/index.js'
```

**Step 2: Initialize broker manager after window creation**

Find where `mainWindow` is created and add after:

```typescript
brokerManager.setMainWindow(mainWindow)
// Test connection on startup (single attempt, no loop)
brokerManager.testConnection()
```

**Step 3: Add broker IPC handlers**

Add these handlers with the other `ipcMainHandle` calls:

```typescript
// Broker handlers
ipcMainHandle('getBrokerConfigs', async () => {
  return brokerManager.getBrokerConfigs()
})

ipcMainHandle('saveBrokerConfig', async (config: BrokerConfig) => {
  brokerManager.saveBrokerConfig(config)
})

ipcMainHandle('getActiveBroker', async () => {
  return brokerManager.getActiveBrokerType()
})

ipcMainHandle('setActiveBroker', async (type: BrokerType) => {
  await brokerManager.setActiveBroker(type)
})

ipcMainHandle('testBrokerConnection', async (type: BrokerType) => {
  return brokerManager.testConnection(type)
})
```

**Step 4: Update queue handlers to use brokerManager**

Replace existing queue handlers:

```typescript
ipcMainHandle('createQueue', async (name: string, options: CreateQueueOptions) => {
  return brokerManager.createQueue(name, options)
})

ipcMainHandle('deleteQueue', async (queueUrl: string) => {
  await brokerManager.deleteQueue(queueUrl)
})

ipcMainHandle('purgeQueue', async (queueUrl: string) => {
  await brokerManager.purgeQueue(queueUrl)
})

ipcMainHandle('sendQueueMessage', async (queueUrl: string, message: string) => {
  await brokerManager.sendMessage(queueUrl, message)
})

ipcMainHandle('getQueueData', async (queueUrl: string) => {
  return brokerManager.getQueueData(queueUrl)
})
```

**Step 5: Update pollQueues to use brokerManager**

Modify the polling function to use broker manager:

```typescript
const pollQueues = (mainWindow: BrowserWindow): NodeJS.Timeout => {
  return setInterval(async () => {
    if (!brokerManager.isConnected()) return
    const queues = await brokerManager.listQueues()
    ipcWebContentsSend('queuesList', mainWindow.webContents, queues)
  }, 500)
}
```

**Step 6: Verify TypeScript compiles**

Run: `npm run transpile:electron`
Expected: No errors

**Step 7: Commit**

```bash
git add src/electron/main.ts
git commit -m "feat(ipc): wire broker manager to IPC handlers"
```

---

### Task 8: Update preload.cts with Broker API

**Files:**
- Modify: `src/electron/preload.cts`

**Step 1: Add broker API methods**

Add to the `electron.contextBridge.exposeInMainWorld` object:

```typescript
  // Broker API
  getBrokerConfigs: () => ipcInvoke('getBrokerConfigs'),
  saveBrokerConfig: (config: BrokerConfig) => ipcInvoke('saveBrokerConfig', config),
  getActiveBroker: () => ipcInvoke('getActiveBroker'),
  setActiveBroker: (type: BrokerType) => ipcInvoke('setActiveBroker', type),
  testBrokerConnection: (type: BrokerType) => ipcInvoke('testBrokerConnection', type),
  subscribeBrokerConnectionState: (callback) =>
    ipcOn('brokerConnectionState', (state) => {
      callback(state)
    }),
```

**Step 2: Verify TypeScript compiles**

Run: `npm run transpile:electron`
Expected: No errors

**Step 3: Commit**

```bash
git add src/electron/preload.cts
git commit -m "feat(preload): expose broker API to renderer"
```

---

## Phase 4: UI Components

### Task 9: Create BrokerContext

**Files:**
- Create: `src/ui/contexts/broker.tsx`

**Step 1: Create the broker context**

```typescript
import { createContext, useContext, useEffect, useState, type FC, type PropsWithChildren } from 'react'

interface BrokerContextValue {
  activeBroker: BrokerType
  connectionState: BrokerConnectionState | null
  configs: BrokerConfig[]
  setActiveBroker: (type: BrokerType) => Promise<void>
  saveBrokerConfig: (config: BrokerConfig) => Promise<void>
  testConnection: (type?: BrokerType) => Promise<BrokerConnectionState>
  isConnected: boolean
}

const BrokerContext = createContext<BrokerContextValue | null>(null)

export function useBroker() {
  const context = useContext(BrokerContext)
  if (!context) {
    throw new Error('useBroker must be used within BrokerProvider')
  }
  return context
}

export const BrokerProvider: FC<PropsWithChildren> = ({ children }) => {
  const [activeBroker, setActiveBrokerState] = useState<BrokerType>('elasticmq')
  const [connectionState, setConnectionState] = useState<BrokerConnectionState | null>(null)
  const [configs, setConfigs] = useState<BrokerConfig[]>([])

  useEffect(() => {
    // Load initial state
    Promise.all([
      window.electron.getActiveBroker(),
      window.electron.getBrokerConfigs(),
    ]).then(([broker, brokerConfigs]) => {
      setActiveBrokerState(broker)
      setConfigs(brokerConfigs)
    })

    // Subscribe to connection state changes
    const unsubscribe = window.electron.subscribeBrokerConnectionState((state) => {
      setConnectionState(state)
    })

    return () => {
      unsubscribe?.()
    }
  }, [])

  const setActiveBroker = async (type: BrokerType) => {
    await window.electron.setActiveBroker(type)
    setActiveBrokerState(type)
  }

  const saveBrokerConfig = async (config: BrokerConfig) => {
    await window.electron.saveBrokerConfig(config)
    setConfigs(prev => prev.map(c => c.type === config.type ? config : c))
  }

  const testConnection = async (type?: BrokerType) => {
    return window.electron.testBrokerConnection(type || activeBroker)
  }

  const isConnected = connectionState?.isConnected ?? false

  return (
    <BrokerContext.Provider value={{
      activeBroker,
      connectionState,
      configs,
      setActiveBroker,
      saveBrokerConfig,
      testConnection,
      isConnected
    }}>
      {children}
    </BrokerContext.Provider>
  )
}
```

**Step 2: Commit**

```bash
git add src/ui/contexts/broker.tsx
git commit -m "feat(ui): add BrokerContext for broker state management"
```

---

### Task 10: Create BrokerSelector Component

**Files:**
- Create: `src/ui/components/BrokerSelector.tsx`

**Step 1: Create the component**

```typescript
import { FC, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'
import { useBroker } from '@/ui/contexts/broker'
import { BrokerSettingsDialog } from './BrokerSettingsDialog'

export const BrokerSelector: FC = () => {
  const { activeBroker, connectionState, setActiveBroker, isConnected } = useBroker()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const handleBrokerChange = async (value: string) => {
    await setActiveBroker(value as BrokerType)
  }

  return (
    <div className="flex items-center gap-2 px-5 py-3 bg-stone-700 rounded-md mx-5">
      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />

      <Select value={activeBroker} onValueChange={handleBrokerChange}>
        <SelectTrigger className="flex-1 bg-transparent border-none text-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="elasticmq">ElasticMQ</SelectItem>
          <SelectItem value="rabbitmq">RabbitMQ</SelectItem>
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-white hover:bg-stone-600"
        onClick={() => setSettingsOpen(true)}
      >
        <Settings className="h-4 w-4" />
      </Button>

      <BrokerSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/ui/components/BrokerSelector.tsx
git commit -m "feat(ui): add BrokerSelector dropdown component"
```

---

### Task 11: Create BrokerSettingsDialog Component

**Files:**
- Create: `src/ui/components/BrokerSettingsDialog.tsx`

**Step 1: Create the dialog component**

```typescript
import { FC, useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useBroker } from '@/ui/contexts/broker'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

interface BrokerSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const BrokerSettingsDialog: FC<BrokerSettingsDialogProps> = ({ open, onOpenChange }) => {
  const { configs, saveBrokerConfig, testConnection } = useBroker()
  const [activeTab, setActiveTab] = useState<BrokerType>('elasticmq')
  const [formData, setFormData] = useState<Record<BrokerType, BrokerConfig>>({} as Record<BrokerType, BrokerConfig>)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<BrokerConnectionState | null>(null)

  useEffect(() => {
    if (configs.length > 0) {
      const configMap = configs.reduce((acc, config) => {
        acc[config.type] = { ...config }
        return acc
      }, {} as Record<BrokerType, BrokerConfig>)
      setFormData(configMap)
    }
  }, [configs])

  const currentConfig = formData[activeTab]

  const updateField = (field: keyof BrokerConfig, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        [field]: value
      }
    }))
    setTestResult(null)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      // Save first to apply changes
      await saveBrokerConfig(formData[activeTab])
      const result = await testConnection(activeTab)
      setTestResult(result)
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    await saveBrokerConfig(formData[activeTab])
    onOpenChange(false)
  }

  if (!currentConfig) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Broker Settings</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as BrokerType); setTestResult(null) }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="elasticmq">ElasticMQ</TabsTrigger>
            <TabsTrigger value="rabbitmq">RabbitMQ</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="host">Host</Label>
                <Input
                  id="host"
                  value={currentConfig.host}
                  onChange={(e) => updateField('host', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  type="number"
                  value={currentConfig.port}
                  onChange={(e) => updateField('port', parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={currentConfig.username}
                  onChange={(e) => updateField('username', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={currentConfig.password}
                  onChange={(e) => updateField('password', e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="useHttps"
                checked={currentConfig.useHttps}
                onCheckedChange={(checked) => updateField('useHttps', !!checked)}
              />
              <Label htmlFor="useHttps">Use HTTPS</Label>
            </div>

            {testResult && (
              <div className={`flex items-center gap-2 p-3 rounded-md ${testResult.isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {testResult.isConnected ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    <span>Connected successfully</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" />
                    <span>{testResult.lastError || 'Connection failed'}</span>
                  </>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Test Connection
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Commit**

```bash
git add src/ui/components/BrokerSettingsDialog.tsx
git commit -m "feat(ui): add BrokerSettingsDialog for configuring broker connections"
```

---

### Task 12: Create BrokerEmptyState Component

**Files:**
- Create: `src/ui/components/BrokerEmptyState.tsx`

**Step 1: Create the empty state component**

```typescript
import { FC } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useBroker } from '@/ui/contexts/broker'

export const BrokerEmptyState: FC = () => {
  const { activeBroker, connectionState, testConnection, configs } = useBroker()

  const config = configs.find(c => c.type === activeBroker)
  const brokerName = activeBroker === 'elasticmq' ? 'ElasticMQ' : 'RabbitMQ'

  const handleRetry = () => {
    testConnection()
  }

  return (
    <div className="flex flex-col items-center justify-center h-[400px] px-8 text-center">
      <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
      <h3 className="text-lg font-semibold mb-2">Not Connected</h3>
      <p className="text-muted-foreground mb-2">
        Could not connect to {brokerName}
        {config && ` on ${config.host}:${config.port}`}
      </p>
      {connectionState?.lastError && (
        <p className="text-sm text-red-400 mb-4">{connectionState.lastError}</p>
      )}
      <p className="text-sm text-muted-foreground mb-6">
        Check if the service is running and the connection settings are correct.
      </p>
      <Button onClick={handleRetry} variant="outline">
        <RefreshCw className="mr-2 h-4 w-4" />
        Retry Connection
      </Button>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/ui/components/BrokerEmptyState.tsx
git commit -m "feat(ui): add BrokerEmptyState component for connection failures"
```

---

### Task 13: Integrate BrokerProvider into App

**Files:**
- Modify: `src/ui/App.tsx`

**Step 1: Import and add BrokerProvider**

Add import:

```typescript
import { BrokerProvider } from './contexts/broker'
```

Wrap QueuesProvider with BrokerProvider:

```typescript
<BrokerProvider>
  <QueuesProvider>
    {/* ... rest of the tree */}
  </QueuesProvider>
</BrokerProvider>
```

**Step 2: Commit**

```bash
git add src/ui/App.tsx
git commit -m "feat(ui): integrate BrokerProvider into app context tree"
```

---

### Task 14: Update QueuesMenu with BrokerSelector

**Files:**
- Modify: `src/ui/components/AppSidebar/QueuesMenu.tsx`

**Step 1: Add imports and components**

```typescript
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, CircleX } from "lucide-react";
import { useState, type FC } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AddNewQueueButton } from "../DialogButtons/AddNewQueueButton";
import { QueuesList } from "./Lists/QueuesList";
import { BrokerSelector } from "../BrokerSelector";
import { BrokerEmptyState } from "../BrokerEmptyState";
import { useBroker } from "@/ui/contexts/broker";

export const QueuesMenu: FC = () => {
  const [queueSearchTerm, setQueueSearchTerm] = useState('')
  const { isConnected } = useBroker()

  return <div>
    <div className="relative h-[35px] mb-4 px-5">
      <Search className="absolute left-8 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input placeholder="Search..." className="pl-9" value={queueSearchTerm} onChange={(ev) => setQueueSearchTerm(ev.target.value)} />
      <Button onClick={() => setQueueSearchTerm('')} className="absolute right-8 top-1/2 h-4 w-4 -translate-y-1/2 bg-transparent hover:bg-transparent text-muted-foreground">
        <CircleX />
      </Button>
    </div>

    <div className="mb-4">
      <BrokerSelector />
    </div>

    <ScrollArea className="h-[calc(100vh-80px-40px-80px-35px-20px-60px)]">
      {isConnected ? (
        <QueuesList searchTerm={queueSearchTerm} />
      ) : (
        <BrokerEmptyState />
      )}
    </ScrollArea>

    <div className="flex justify-between items-center px-4 gap-20 h-[80px] bg-stone-600">
      <AddNewQueueButton />
    </div>
  </div>
}
```

**Step 2: Commit**

```bash
git add src/ui/components/AppSidebar/QueuesMenu.tsx
git commit -m "feat(ui): integrate BrokerSelector into QueuesMenu"
```

---

## Phase 5: Cleanup & Testing

### Task 15: Remove Old SQS Files

**Files:**
- Delete: `src/electron/utils/sqs.ts`
- Delete: `src/electron/sqs/list-queues.ts`
- Delete: `src/electron/sqs/create-queue.ts`
- Delete: `src/electron/sqs/delete-queue.ts`
- Delete: `src/electron/sqs/purge-queue.ts`
- Delete: `src/electron/sqs/send-queue-message.ts`
- Keep: Other files that may still be referenced

**Step 1: Remove deprecated files**

Run:

```bash
rm src/electron/utils/sqs.ts
rm src/electron/sqs/list-queues.ts
rm src/electron/sqs/create-queue.ts
rm src/electron/sqs/delete-queue.ts
rm src/electron/sqs/purge-queue.ts
rm src/electron/sqs/send-queue-message.ts
```

**Step 2: Update any remaining imports in main.ts**

Remove old imports and ensure broker manager is used everywhere.

**Step 3: Verify build**

Run: `npm run build`
Expected: No errors

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove deprecated SQS files in favor of broker abstraction"
```

---

### Task 16: Manual Testing Checklist

**Test each item and verify:**

- [ ] App starts without errors
- [ ] ElasticMQ connection works with default settings
- [ ] RabbitMQ connection works with default settings (HTTPS on 15671)
- [ ] Can switch between brokers via dropdown
- [ ] Settings dialog opens with gear button
- [ ] Can modify host/port/credentials
- [ ] Test Connection button works
- [ ] Settings are saved and persist after app restart
- [ ] Active broker selection persists after app restart
- [ ] Connection failure shows empty state with error message
- [ ] Retry button reconnects
- [ ] Queue list loads for both brokers
- [ ] Can create a queue on both brokers
- [ ] Can delete a queue on both brokers
- [ ] Can send messages on both brokers
- [ ] No infinite polling loop on connection failure

---

### Task 17: Final Commit

**Step 1: Ensure all files are committed**

Run: `git status`

**Step 2: Create summary commit if needed**

```bash
git add -A
git commit -m "feat: complete multi-broker support with ElasticMQ and RabbitMQ"
```

---

## Summary

This plan implements:

1. **Types & Schema** - BrokerConfig, BrokerConnectionState, store schema updates
2. **Backend** - BrokerClient interface, ElasticMQ implementation, RabbitMQ implementation, BrokerManager singleton
3. **IPC** - New handlers for broker config, active broker, test connection
4. **UI** - BrokerContext, BrokerSelector dropdown, BrokerSettingsDialog, BrokerEmptyState
5. **Integration** - Wire everything together, update QueuesMenu
6. **Cleanup** - Remove deprecated SQS files

Total: 17 tasks, ~15 files created/modified
