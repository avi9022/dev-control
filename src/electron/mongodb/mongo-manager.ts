import { MongoClient, type Db } from 'mongodb'
import { store } from '../storage/store.js'
import { ipcWebContentsSend } from '../utils/ipc-handle.js'
import type { BrowserWindow } from 'electron'

class MongoManager {
  private clients: Map<string, MongoClient> = new Map()
  private activeConnectionId: string | null = null
  private connectionState: MongoConnectionState | null = null
  private mainWindow: BrowserWindow | null = null

  constructor() {
    this.activeConnectionId = store.get('activeMongoConnectionId') || null
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  async autoReconnect(): Promise<void> {
    if (!this.activeConnectionId) return

    const config = this.getConnections().find(c => c.id === this.activeConnectionId)
    if (!config) {
      this.activeConnectionId = null
      store.set('activeMongoConnectionId', null)
      return
    }

    await this.testConnection(this.activeConnectionId)
  }

  getConnections(): MongoConnectionConfig[] {
    return store.get('mongoConnections') || []
  }

  saveConnection(config: MongoConnectionConfig): void {
    const connections = this.getConnections()
    const existingIndex = connections.findIndex(c => c.id === config.id)

    const updatedConnections = existingIndex >= 0
      ? connections.map((c, i) => i === existingIndex ? config : c)
      : [...connections, config]

    store.set('mongoConnections', updatedConnections)

    if (config.id === this.activeConnectionId) {
      this.closeClient(config.id)
    }
  }

  deleteConnection(id: string): void {
    const connections = this.getConnections()
    const updatedConnections = connections.filter(c => c.id !== id)
    store.set('mongoConnections', updatedConnections)

    this.closeClient(id)

    if (id === this.activeConnectionId) {
      this.activeConnectionId = null
      store.set('activeMongoConnectionId', null)
      this.emitConnectionState({
        connectionId: '',
        status: 'disconnected'
      })
    }
  }

  async testConnection(connectionId: string): Promise<MongoConnectionState> {
    const connections = this.getConnections()
    const config = connections.find(c => c.id === connectionId)

    if (!config) {
      const errorState: MongoConnectionState = {
        connectionId,
        status: 'error',
        error: 'Connection configuration not found'
      }
      this.emitConnectionState(errorState)
      return errorState
    }

    const connectingState: MongoConnectionState = {
      connectionId,
      status: 'connecting'
    }
    this.emitConnectionState(connectingState)

    try {
      const uri = this.buildConnectionString(config)
      const client = new MongoClient(uri, {
        connectTimeoutMS: 5000,
        serverSelectionTimeoutMS: 5000
      })

      await client.connect()
      const adminDb = client.db('admin')
      const serverInfo = await adminDb.command({ buildInfo: 1 })

      await client.close()

      const state: MongoConnectionState = {
        connectionId,
        status: 'connected',
        serverVersion: serverInfo.version
      }

      if (connectionId === this.activeConnectionId) {
        this.connectionState = state
      }

      this.emitConnectionState(state)
      return state
    } catch (error) {
      const state: MongoConnectionState = {
        connectionId,
        status: 'error',
        error: error instanceof Error ? error.message : 'Connection failed'
      }

      if (connectionId === this.activeConnectionId) {
        this.connectionState = state
      }

      this.emitConnectionState(state)
      return state
    }
  }

  async setActiveConnection(id: string): Promise<void> {
    this.activeConnectionId = id
    store.set('activeMongoConnectionId', id)
    await this.testConnection(id)
  }

  async disconnect(): Promise<void> {
    if (this.activeConnectionId) {
      await this.closeClient(this.activeConnectionId)
    }
    this.activeConnectionId = null
    store.set('activeMongoConnectionId', null)
    this.connectionState = null
    this.emitConnectionState({
      connectionId: '',
      status: 'disconnected'
    })
  }

  getClient(): MongoClient {
    if (!this.activeConnectionId) {
      throw new Error('No active MongoDB connection configured.')
    }

    const existing = this.clients.get(this.activeConnectionId)
    if (existing) {
      return existing
    }

    const config = this.getConnections().find(c => c.id === this.activeConnectionId)
    if (!config) {
      throw new Error('Active connection configuration not found.')
    }

    const uri = this.buildConnectionString(config)
    const client = new MongoClient(uri, {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000
    })

    this.clients.set(this.activeConnectionId, client)
    return client
  }

  getDb(name?: string): Db {
    const client = this.getClient()
    const dbName = name || this.getDefaultDatabase()
    if (!dbName) {
      throw new Error('No database name provided and no default database configured.')
    }
    return client.db(dbName)
  }

  getActiveConnectionId(): string | null {
    return this.activeConnectionId
  }

  isConnected(): boolean {
    return this.connectionState?.status === 'connected'
  }

  private buildConnectionString(config: MongoConnectionConfig): string {
    if (config.connectionString && config.connectionString.trim().length > 0) {
      return config.connectionString
    }

    const protocol = config.ssl ? 'mongodb+srv' : 'mongodb'
    const auth = config.username && config.password
      ? `${encodeURIComponent(config.username)}:${encodeURIComponent(config.password)}@`
      : ''
    const host = config.host || 'localhost'
    const port = config.ssl ? '' : `:${config.port || 27017}`
    const database = config.database || ''
    const params: string[] = []

    if (config.authSource) {
      params.push(`authSource=${config.authSource}`)
    }
    if (config.replicaSet) {
      params.push(`replicaSet=${config.replicaSet}`)
    }
    if (config.ssl) {
      params.push('tls=true')
    }

    const query = params.length > 0 ? `?${params.join('&')}` : ''

    return `${protocol}://${auth}${host}${port}/${database}${query}`
  }

  private getDefaultDatabase(): string | undefined {
    if (!this.activeConnectionId) return undefined
    const config = this.getConnections().find(c => c.id === this.activeConnectionId)
    return config?.database || undefined
  }

  private async closeClient(id: string): Promise<void> {
    const client = this.clients.get(id)
    if (client) {
      try {
        await client.close()
      } catch (error) {
        // Ignore close errors gracefully
      }
      this.clients.delete(id)
    }
  }

  private emitConnectionState(state: MongoConnectionState): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      ipcWebContentsSend('subscribeMongoConnectionState', this.mainWindow.webContents, state)
    }
  }
}

export const mongoManager = new MongoManager()
