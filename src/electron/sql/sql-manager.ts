import oracledb from 'oracledb'
import { BrowserWindow } from 'electron'
import Store from 'electron-store'
import { ipcWebContentsSend } from '../utils/ipc-handle.js'

const store = new Store()

class SQLManager {
  private mainWindow: BrowserWindow | null = null
  private connection: oracledb.Connection | null = null
  private activeConnectionId: string | null = null

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  // ─── Connection Storage ───

  getConnections(): SQLConnectionConfig[] {
    return (store.get('sqlConnections') as SQLConnectionConfig[] | undefined) ?? []
  }

  saveConnection(config: SQLConnectionConfig): void {
    const connections = this.getConnections()
    const idx = connections.findIndex((c) => c.id === config.id)
    if (idx >= 0) {
      const updated = [...connections]
      updated[idx] = { ...config, updatedAt: Date.now() }
      store.set('sqlConnections', updated)
    } else {
      store.set('sqlConnections', [...connections, { ...config, createdAt: Date.now(), updatedAt: Date.now() }])
    }
  }

  deleteConnection(id: string): void {
    const connections = this.getConnections().filter((c) => c.id !== id)
    store.set('sqlConnections', connections)
    if (this.activeConnectionId === id) {
      this.disconnect().catch(() => {})
    }
  }

  getActiveConnectionId(): string | null {
    return this.activeConnectionId
  }

  // ─── Connection Lifecycle ───

  async testConnection(id: string): Promise<SQLConnectionState> {
    const config = this.getConnections().find((c) => c.id === id)
    if (!config) {
      return { connectionId: id, status: 'error', error: 'Connection not found' }
    }

    let testConn: oracledb.Connection | null = null
    try {
      testConn = await oracledb.getConnection(this.buildConnectConfig(config))
      const versionResult = await testConn.execute<[string]>('SELECT banner FROM v$version WHERE ROWNUM = 1')
      const serverVersion = versionResult.rows?.[0]?.[0] ?? 'Unknown'
      const schemaResult = await testConn.execute<[string]>('SELECT USER FROM DUAL')
      const currentSchema = schemaResult.rows?.[0]?.[0] ?? config.username.toUpperCase()

      return {
        connectionId: id,
        status: 'connected',
        serverVersion,
        currentSchema,
      }
    } catch (error) {
      return {
        connectionId: id,
        status: 'error',
        error: error instanceof Error ? error.message : 'Connection failed',
      }
    } finally {
      if (testConn) {
        try { await testConn.close() } catch { /* ignore */ }
      }
    }
  }

  async setActiveConnection(id: string): Promise<void> {
    if (this.connection) {
      await this.disconnect()
    }

    const config = this.getConnections().find((c) => c.id === id)
    if (!config) {
      throw new Error('Connection not found')
    }

    this.emitConnectionState({ connectionId: id, status: 'connecting' })

    try {
      this.connection = await oracledb.getConnection(this.buildConnectConfig(config))
      this.activeConnectionId = id

      const versionResult = await this.connection.execute<[string]>('SELECT banner FROM v$version WHERE ROWNUM = 1')
      const serverVersion = versionResult.rows?.[0]?.[0] ?? 'Unknown'
      const schemaResult = await this.connection.execute<[string]>('SELECT USER FROM DUAL')
      const currentSchema = schemaResult.rows?.[0]?.[0] ?? config.username.toUpperCase()

      this.emitConnectionState({
        connectionId: id,
        status: 'connected',
        serverVersion,
        currentSchema,
      })
    } catch (error) {
      this.activeConnectionId = null
      this.connection = null
      const msg = error instanceof Error ? error.message : 'Connection failed'
      this.emitConnectionState({ connectionId: id, status: 'error', error: msg })
      throw new Error(msg)
    }
  }

  async disconnect(): Promise<void> {
    const connId = this.activeConnectionId
    if (this.connection) {
      try { await this.connection.close() } catch { /* ignore */ }
      this.connection = null
    }
    this.activeConnectionId = null
    if (connId) {
      this.emitConnectionState({ connectionId: connId, status: 'disconnected' })
    }
  }

  getConnection(): oracledb.Connection {
    if (!this.connection) {
      throw new Error('No active SQL connection')
    }
    return this.connection
  }

  isConnected(): boolean {
    return this.connection !== null
  }

  // ─── Helpers ───

  private buildConnectConfig(config: SQLConnectionConfig): oracledb.ConnectionAttributes {
    const connectString = config.sid
      ? `${config.host}:${config.port}/${config.sid}`
      : `${config.host}:${config.port}/${config.serviceName ?? 'XE'}`

    return {
      user: config.username,
      password: config.password,
      connectString,
    }
  }

  private emitConnectionState(state: SQLConnectionState): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      ipcWebContentsSend('subscribeSQLConnectionState', this.mainWindow.webContents, state)
    }
  }
}

export const sqlManager = new SQLManager()
