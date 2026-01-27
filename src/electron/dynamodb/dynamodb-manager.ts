import { DynamoDBClient, type DynamoDBClientConfig, ListTablesCommand } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb"
import { BrowserWindow } from "electron"
import { store, DEFAULT_DYNAMODB_CONNECTION } from "../storage/store.js"
import { ipcWebContentsSend } from "../utils/ipc-handle.js"

class DynamoDBManager {
  private rawClient: DynamoDBClient | null = null
  private docClient: DynamoDBDocumentClient | null = null
  private activeConnectionId: string | null = null
  private connectionState: DynamoDBConnectionState | null = null
  private mainWindow: BrowserWindow | null = null

  constructor() {
    this.activeConnectionId = store.get('activeDynamoDBConnection') || null
    this.rebuildClients()
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  private getActiveConfig(): DynamoDBConnectionConfig | null {
    if (!this.activeConnectionId) return null
    const connections = store.get('dynamodbConnections') || [DEFAULT_DYNAMODB_CONNECTION]
    return connections.find(c => c.id === this.activeConnectionId) || null
  }

  private buildClientConfig(config: DynamoDBConnectionConfig): DynamoDBClientConfig {
    const clientConfig: DynamoDBClientConfig = {
      region: config.region
    }

    switch (config.connectionMethod) {
      case 'custom-endpoint':
        clientConfig.endpoint = config.endpoint
        clientConfig.credentials = {
          accessKeyId: config.accessKeyId || 'root',
          secretAccessKey: config.secretAccessKey || 'root'
        }
        break

      case 'aws-credentials':
        clientConfig.credentials = {
          accessKeyId: config.accessKeyId || '',
          secretAccessKey: config.secretAccessKey || ''
        }
        break

      case 'aws-profile':
        break
    }

    return clientConfig
  }

  private async rebuildClients(): Promise<void> {
    const config = this.getActiveConfig()
    if (!config) {
      this.rawClient = null
      this.docClient = null
      return
    }

    if (config.connectionMethod === 'aws-profile') {
      try {
        const { fromIni } = await import('@aws-sdk/credential-providers')
        const clientConfig = {
          region: config.region,
          credentials: fromIni({ profile: config.profileName || 'default' })
        }
        this.rawClient = new DynamoDBClient(clientConfig)
      } catch (error) {
        console.error('Failed to load AWS profile credentials:', error)
        this.rawClient = null
        this.docClient = null
        return
      }
    } else {
      const clientConfig = this.buildClientConfig(config)
      this.rawClient = new DynamoDBClient(clientConfig)
    }

    this.docClient = DynamoDBDocumentClient.from(this.rawClient, {
      marshallOptions: {
        removeUndefinedValues: true
      }
    })
  }

  getRawClient(): DynamoDBClient {
    if (!this.rawClient) {
      throw new Error('DynamoDB client not initialized. No active connection configured.')
    }
    return this.rawClient
  }

  getDocClient(): DynamoDBDocumentClient {
    if (!this.docClient) {
      throw new Error('DynamoDB document client not initialized. No active connection configured.')
    }
    return this.docClient
  }

  getActiveConnectionId(): string | null {
    return this.activeConnectionId
  }

  getConnections(): DynamoDBConnectionConfig[] {
    return store.get('dynamodbConnections') || [DEFAULT_DYNAMODB_CONNECTION]
  }

  saveConnection(config: DynamoDBConnectionConfig): void {
    const connections = this.getConnections()
    const existingIndex = connections.findIndex(c => c.id === config.id)

    const updatedConnections = existingIndex >= 0
      ? connections.map((c, i) => i === existingIndex ? config : c)
      : [...connections, config]

    store.set('dynamodbConnections', updatedConnections)

    if (config.id === this.activeConnectionId) {
      this.rebuildClients()
    }
  }

  deleteConnection(id: string): void {
    const connections = this.getConnections()
    const updatedConnections = connections.filter(c => c.id !== id)
    store.set('dynamodbConnections', updatedConnections)

    if (id === this.activeConnectionId) {
      const newActive = updatedConnections[0]?.id || null
      this.activeConnectionId = newActive
      store.set('activeDynamoDBConnection', newActive)
      this.rebuildClients()
      this.testConnection()
    }
  }

  async setActiveConnection(id: string): Promise<void> {
    this.activeConnectionId = id
    store.set('activeDynamoDBConnection', id)
    await this.rebuildClients()
    await this.testConnection()
  }

  async testConnection(connectionId?: string): Promise<DynamoDBConnectionState> {
    const targetId = connectionId || this.activeConnectionId

    if (!targetId) {
      const errorState: DynamoDBConnectionState = {
        connectionId: '',
        isConnected: false,
        lastError: 'No connection configured',
        lastChecked: Date.now()
      }
      this.emitConnectionState(errorState)
      return errorState
    }

    // If testing a non-active connection, build temporary clients
    let client: DynamoDBClient
    if (connectionId && connectionId !== this.activeConnectionId) {
      const connections = this.getConnections()
      const config = connections.find(c => c.id === connectionId)
      if (!config) {
        return {
          connectionId,
          isConnected: false,
          lastError: 'Connection not found',
          lastChecked: Date.now()
        }
      }

      if (config.connectionMethod === 'aws-profile') {
        try {
          const { fromIni } = await import('@aws-sdk/credential-providers')
          client = new DynamoDBClient({
            region: config.region,
            credentials: fromIni({ profile: config.profileName || 'default' })
          })
        } catch (error) {
          return {
            connectionId,
            isConnected: false,
            lastError: error instanceof Error ? error.message : 'Failed to load profile',
            lastChecked: Date.now()
          }
        }
      } else {
        client = new DynamoDBClient(this.buildClientConfig(config))
      }
    } else {
      if (!this.rawClient) {
        const errorState: DynamoDBConnectionState = {
          connectionId: targetId,
          isConnected: false,
          lastError: 'Client not initialized',
          lastChecked: Date.now()
        }
        this.emitConnectionState(errorState)
        return errorState
      }
      client = this.rawClient
    }

    try {
      await client.send(new ListTablesCommand({ Limit: 1 }))
      const state: DynamoDBConnectionState = {
        connectionId: targetId,
        isConnected: true,
        lastChecked: Date.now()
      }

      if (!connectionId || connectionId === this.activeConnectionId) {
        this.connectionState = state
        this.emitConnectionState(state)
      }

      return state
    } catch (error) {
      const state: DynamoDBConnectionState = {
        connectionId: targetId,
        isConnected: false,
        lastError: error instanceof Error ? error.message : 'Connection failed',
        lastChecked: Date.now()
      }

      if (!connectionId || connectionId === this.activeConnectionId) {
        this.connectionState = state
        this.emitConnectionState(state)
      }

      return state
    }
  }

  private emitConnectionState(state: DynamoDBConnectionState): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      ipcWebContentsSend('dynamodbConnectionState', this.mainWindow.webContents, state)
    }
  }

  isConnected(): boolean {
    return this.connectionState?.isConnected ?? false
  }
}

export const dynamoDBManager = new DynamoDBManager()
