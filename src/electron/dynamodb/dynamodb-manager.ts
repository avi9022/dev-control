import { DynamoDBClient, type DynamoDBClientConfig, ListTablesCommand } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb"
import { BrowserWindow } from "electron"
import { store, DEFAULT_DYNAMODB_CONNECTION } from "../storage/store.js"
import { ipcWebContentsSend } from "../utils/ipc-handle.js"

interface ClientPair {
  raw: DynamoDBClient
  doc: DynamoDBDocumentClient
}

// True when an error is an IAM authorization denial (as opposed to a transient
// failure like throttling or a network blip). Used both to flag a connection
// read-only and to hide tables the role cannot read at all.
const isAccessDenied = (error: unknown): boolean => {
  const name = (error as { name?: string })?.name || ''
  const message = error instanceof Error ? error.message : ''
  return name === 'AccessDeniedException' || /not authorized to perform/i.test(message)
}

class DynamoDBManager {
  private clients = new Map<string, ClientPair>()
  private states = new Map<string, DynamoDBConnectionState>()
  private mainWindow: BrowserWindow | null = null

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  getConnections(): DynamoDBConnectionConfig[] {
    const stored = store.get('dynamodbConnections')
    const connections = stored && stored.length > 0 ? stored : [DEFAULT_DYNAMODB_CONNECTION]
    // Normalize connections persisted before `enabled` existed: treat missing as enabled.
    return connections.map(c => ({ ...c, enabled: c.enabled ?? true }))
  }

  getConnectionStates(): DynamoDBConnectionState[] {
    return Array.from(this.states.values())
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
          secretAccessKey: config.secretAccessKey || 'root',
          ...(config.sessionToken ? { sessionToken: config.sessionToken } : {})
        }
        break

      case 'aws-credentials':
        clientConfig.credentials = {
          accessKeyId: config.accessKeyId || '',
          secretAccessKey: config.secretAccessKey || '',
          ...(config.sessionToken ? { sessionToken: config.sessionToken } : {})
        }
        break

      case 'aws-profile':
        break
    }

    return clientConfig
  }

  private async createRawClient(config: DynamoDBConnectionConfig): Promise<DynamoDBClient> {
    if (config.connectionMethod === 'aws-profile') {
      const { fromIni } = await import('@aws-sdk/credential-providers')
      return new DynamoDBClient({
        region: config.region,
        credentials: fromIni({ profile: config.profileName || 'default' })
      })
    }
    return new DynamoDBClient(this.buildClientConfig(config))
  }

  private buildClientPair(raw: DynamoDBClient): ClientPair {
    const doc = DynamoDBDocumentClient.from(raw, {
      marshallOptions: { removeUndefinedValues: true }
    })
    return { raw, doc }
  }

  // Connect every enabled connection. Each is independent — a slow/failed
  // cloud connection never blocks the others.
  async connectAll(): Promise<void> {
    const connections = this.getConnections()
    await Promise.all(
      connections.map(c => (c.enabled ? this.connectOne(c.id) : this.disconnectOne(c.id)))
    )
  }

  async connectOne(id: string): Promise<void> {
    const config = this.getConnections().find(c => c.id === id)
    if (!config) return

    try {
      const raw = await this.createRawClient(config)
      this.clients.set(id, this.buildClientPair(raw))
      await this.testConnection(id)
    } catch (error) {
      this.clients.delete(id)
      this.setState({
        connectionId: id,
        isConnected: false,
        lastError: error instanceof Error ? error.message : 'Failed to connect',
        lastChecked: Date.now()
      })
    }
  }

  disconnectOne(id: string): void {
    this.clients.delete(id)
    this.states.delete(id)
    this.setState({ connectionId: id, isConnected: false, lastChecked: Date.now() })
  }

  getRawClient(connectionId: string): DynamoDBClient {
    const pair = this.clients.get(connectionId)
    if (!pair) {
      throw new Error(`DynamoDB connection "${connectionId}" is not connected.`)
    }
    return pair.raw
  }

  getDocClient(connectionId: string): DynamoDBDocumentClient {
    const pair = this.clients.get(connectionId)
    if (!pair) {
      throw new Error(`DynamoDB connection "${connectionId}" is not connected.`)
    }
    return pair.doc
  }

  // List tables across every connected client, tagged with their connection.
  // A single connection failing (e.g. expired token) is recorded and skipped
  // rather than failing the whole list.
  async listAllTables(): Promise<DynamoDBTableRef[]> {
    const connections = this.getConnections()
    const refs: DynamoDBTableRef[] = []

    await Promise.all(
      Array.from(this.clients.keys()).map(async (connectionId) => {
        const name = connections.find(c => c.id === connectionId)?.name || connectionId
        try {
          const tableNames: string[] = []
          let lastEvaluatedTableName: string | undefined
          do {
            const response = await this.getRawClient(connectionId).send(
              new ListTablesCommand({ ExclusiveStartTableName: lastEvaluatedTableName, Limit: 100 })
            )
            tableNames.push(...(response.TableNames || []))
            lastEvaluatedTableName = response.LastEvaluatedTableName
          } while (lastEvaluatedTableName)

          // ListTables returns every table in the account, including ones a
          // scoped role cannot read. Probe each and surface only the readable
          // ones so inaccessible tables never appear in the sidebar.
          const readable = await Promise.all(
            tableNames.map(async (tableName) =>
              (await this.isTableReadable(connectionId, tableName)) ? tableName : null
            )
          )

          for (const tableName of readable) {
            if (tableName) refs.push({ connectionId, connectionName: name, tableName })
          }
        } catch (error) {
          this.handleOperationError(connectionId, error)
        }
      })
    )

    return refs.sort((a, b) =>
      a.connectionName.localeCompare(b.connectionName) || a.tableName.localeCompare(b.tableName)
    )
  }

  // Probes whether the current credentials can read a table. ListTables happily
  // returns tables a scoped role has no access to; a 1-item Scan is the cheapest
  // truthful test of the read permission the UI actually needs. An access denial
  // hides the table; any other error (throttling, network) keeps it visible so a
  // transient blip never silently drops a table the user can normally read.
  private async isTableReadable(connectionId: string, tableName: string): Promise<boolean> {
    try {
      await this.getDocClient(connectionId).send(new ScanCommand({ TableName: tableName, Limit: 1 }))
      return true
    } catch (error) {
      return !isAccessDenied(error)
    }
  }

  saveConnection(config: DynamoDBConnectionConfig): void {
    const connections = this.getConnections()
    const existingIndex = connections.findIndex(c => c.id === config.id)

    const updatedConnections = existingIndex >= 0
      ? connections.map((c, i) => i === existingIndex ? config : c)
      : [...connections, config]

    store.set('dynamodbConnections', updatedConnections)

    // Rebuild the client so credential/endpoint edits take effect immediately.
    if (config.enabled) {
      this.connectOne(config.id)
    } else {
      this.disconnectOne(config.id)
    }
  }

  deleteConnection(id: string): void {
    const updatedConnections = this.getConnections().filter(c => c.id !== id)
    store.set('dynamodbConnections', updatedConnections)
    this.disconnectOne(id)
  }

  async setConnectionEnabled(id: string, enabled: boolean): Promise<void> {
    const connections = this.getConnections()
    const updated = connections.map(c => c.id === id ? { ...c, enabled } : c)
    store.set('dynamodbConnections', updated)

    if (enabled) {
      await this.connectOne(id)
    } else {
      this.disconnectOne(id)
    }
  }

  // Tests connectivity for a connection, building a temporary client when the
  // connection isn't already connected (used by the settings "Test" button).
  async testConnection(connectionId: string): Promise<DynamoDBConnectionState> {
    const config = this.getConnections().find(c => c.id === connectionId)
    if (!config) {
      const state: DynamoDBConnectionState = {
        connectionId, isConnected: false, lastError: 'Connection not found', lastChecked: Date.now()
      }
      this.setState(state)
      return state
    }

    // Always build a fresh client so the test reflects the current credentials —
    // critical for `aws-profile`, whose ~/.aws/credentials token may have just
    // been refreshed (a cached fromIni provider would still hand back the old,
    // expired token).
    let client: DynamoDBClient
    try {
      client = await this.createRawClient(config)
    } catch (error) {
      const state: DynamoDBConnectionState = {
        connectionId,
        isConnected: false,
        lastError: error instanceof Error ? error.message : 'Failed to build client',
        lastChecked: Date.now()
      }
      this.setState(state)
      return state
    }

    // If this connection is live, swap in the fresh client so subsequent
    // operations use the refreshed credentials too.
    if (this.clients.has(connectionId)) {
      this.clients.set(connectionId, this.buildClientPair(client))
    }

    try {
      await client.send(new ListTablesCommand({ Limit: 1 }))
      const prev = this.states.get(connectionId)
      const state: DynamoDBConnectionState = {
        connectionId,
        isConnected: true,
        readOnlyTables: prev?.readOnlyTables,
        lastChecked: Date.now()
      }
      this.setState(state)
      return state
    } catch (error) {
      const state = this.classifyError(connectionId, error)
      this.setState(state)
      return state
    }
  }

  // Records an operation error against a connection's state (read-only on
  // write denial, expired on token expiry) and emits it, so the UI can adapt.
  handleOperationError(connectionId: string, error: unknown, tableName?: string): void {
    this.setState(this.classifyError(connectionId, error, tableName))
  }

  private classifyError(connectionId: string, error: unknown, tableName?: string): DynamoDBConnectionState {
    const prev = this.states.get(connectionId)
    const name = (error as { name?: string })?.name || ''
    const message = error instanceof Error ? error.message : 'Operation failed'

    const expired = name === 'ExpiredTokenException'
      || name === 'ExpiredToken'
      || /expired/i.test(message)
    const isWriteDenial = isAccessDenied(error) && /PutItem|DeleteItem|UpdateItem|BatchWrite/i.test(message)

    // A write denial flags only the offending table, never the whole connection:
    // sibling tables under the same role may well be writable. Accumulate denied
    // tables so earlier flags survive subsequent state emissions.
    const readOnlyTables = isWriteDenial && tableName
      ? Array.from(new Set([...(prev?.readOnlyTables ?? []), tableName]))
      : prev?.readOnlyTables

    return {
      connectionId,
      // Expired/invalid credentials drop the connection; a write denial keeps it
      // connected and only marks the specific table read-only.
      isConnected: expired ? false : (prev?.isConnected ?? true),
      readOnlyTables,
      expired: expired || undefined,
      lastError: message,
      lastChecked: Date.now()
    }
  }

  private setState(state: DynamoDBConnectionState): void {
    this.states.set(state.connectionId, state)
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      ipcWebContentsSend('dynamodbConnectionState', this.mainWindow.webContents, state)
    }
  }
}

export const dynamoDBManager = new DynamoDBManager()
