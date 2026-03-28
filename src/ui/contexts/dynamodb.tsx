import { createContext, useContext, useState, useEffect, useCallback, type FC, type PropsWithChildren } from 'react'
import { useViews } from '@/ui/contexts/views'

interface DynamoDBContextValue {
  tables: string[]
  loading: boolean
  error: string | null
  refreshTables: () => Promise<void>
  selectTable: (tableName: string | null) => void
  selectedTable: string | null
  getTableInfo: (tableName: string) => Promise<DynamoDBTableInfo>
  scanTable: (tableName: string, options?: DynamoDBScanOptions) => Promise<DynamoDBScanResult>
  queryTable: (tableName: string, options: DynamoDBQueryOptions) => Promise<DynamoDBScanResult>
  getItem: (tableName: string, key: Record<string, unknown>) => Promise<Record<string, unknown> | null>
  putItem: (tableName: string, item: Record<string, unknown>) => Promise<void>
  deleteItem: (tableName: string, key: Record<string, unknown>) => Promise<void>
  connections: DynamoDBConnectionConfig[]
  activeConnectionId: string | null
  connectionState: DynamoDBConnectionState | null
  isConnected: boolean
  setActiveConnection: (id: string) => Promise<void>
  saveConnection: (config: DynamoDBConnectionConfig) => Promise<void>
  deleteConnection: (id: string) => Promise<void>
  testConnection: (id?: string) => Promise<DynamoDBConnectionState>
}

export const DynamoDBContext = createContext<DynamoDBContextValue>({
  tables: [],
  loading: false,
  error: null,
  refreshTables: async () => {},
  selectTable: () => {},
  selectedTable: null,
  getTableInfo: async () => ({} as DynamoDBTableInfo),
  scanTable: async () => ({ items: [], count: 0, scannedCount: 0 }),
  queryTable: async () => ({ items: [], count: 0, scannedCount: 0 }),
  getItem: async () => null,
  putItem: async () => {},
  deleteItem: async () => {},
  connections: [],
  activeConnectionId: null,
  connectionState: null,
  isConnected: false,
  setActiveConnection: async () => {},
  saveConnection: async () => {},
  deleteConnection: async () => {},
  testConnection: async () => ({ connectionId: '', isConnected: false }),
})

export function useDynamoDB() {
  return useContext(DynamoDBContext)
}

export const DynamoDBProvider: FC<PropsWithChildren> = ({ children }) => {
  const [tables, setTables] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [connections, setConnections] = useState<DynamoDBConnectionConfig[]>([])
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null)
  const [connectionState, setConnectionState] = useState<DynamoDBConnectionState | null>(null)
  const { updateView } = useViews()

  const isConnected = connectionState?.isConnected ?? false

  const loadConnections = useCallback(async () => {
    const conns = await window.electron.getDynamoDBConnections()
    setConnections(conns)
    const activeId = await window.electron.getActiveDynamoDBConnection()
    setActiveConnectionId(activeId)
  }, [])

  const refreshTables = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const tableList = await window.electron.dynamodbListTables()
      setTables(tableList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tables')
      setTables([])
    } finally {
      setLoading(false)
    }
  }, [])

  const selectTable = useCallback((tableName: string | null) => {
    setSelectedTable(tableName)
    updateView('dynamodb', tableName)
  }, [updateView])

  const setActiveConnection = useCallback(async (id: string) => {
    await window.electron.setActiveDynamoDBConnection(id)
    setActiveConnectionId(id)
  }, [])

  const saveConnection = useCallback(async (config: DynamoDBConnectionConfig) => {
    await window.electron.saveDynamoDBConnection(config)
    await loadConnections()
  }, [loadConnections])

  const deleteConnection = useCallback(async (id: string) => {
    await window.electron.deleteDynamoDBConnection(id)
    await loadConnections()
  }, [loadConnections])

  const testConnection = useCallback(async (id?: string) => {
    const targetId = id || activeConnectionId
    if (!targetId) {
      return { connectionId: '', isConnected: false, lastError: 'No connection', lastChecked: Date.now() }
    }
    return await window.electron.testDynamoDBConnection(targetId)
  }, [activeConnectionId])

  const getTableInfo = useCallback(async (tableName: string) => {
    return await window.electron.dynamodbDescribeTable(tableName)
  }, [])

  const scanTable = useCallback(async (tableName: string, options?: DynamoDBScanOptions) => {
    return await window.electron.dynamodbScanTable(tableName, options)
  }, [])

  const queryTable = useCallback(async (tableName: string, options: DynamoDBQueryOptions) => {
    return await window.electron.dynamodbQueryTable(tableName, options)
  }, [])

  const getItem = useCallback(async (tableName: string, key: Record<string, unknown>) => {
    return await window.electron.dynamodbGetItem(tableName, key)
  }, [])

  const putItem = useCallback(async (tableName: string, item: Record<string, unknown>) => {
    return await window.electron.dynamodbPutItem(tableName, item)
  }, [])

  const deleteItem = useCallback(async (tableName: string, key: Record<string, unknown>) => {
    return await window.electron.dynamodbDeleteItem(tableName, key)
  }, [])

  // Subscribe to connection state changes
  useEffect(() => {
    return window.electron.subscribeDynamoDBConnectionState((state) => {
      setConnectionState(state)
    })
  }, [])

  // Load connections on mount
  useEffect(() => {
    loadConnections()
  }, [loadConnections])

  // Refresh tables when connection state changes to connected
  useEffect(() => {
    if (isConnected) {
      refreshTables()
    } else {
      setTables([])
    }
  }, [isConnected, activeConnectionId, refreshTables])

  return (
    <DynamoDBContext.Provider
      value={{
        tables,
        loading,
        error,
        refreshTables,
        selectTable,
        selectedTable,
        getTableInfo,
        scanTable,
        queryTable,
        getItem,
        putItem,
        deleteItem,
        connections,
        activeConnectionId,
        connectionState,
        isConnected,
        setActiveConnection,
        saveConnection,
        deleteConnection,
        testConnection,
      }}
    >
      {children}
    </DynamoDBContext.Provider>
  )
}
