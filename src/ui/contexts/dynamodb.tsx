import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type FC, type PropsWithChildren } from 'react'
import { toast } from 'sonner'
import { useViews } from '@/ui/contexts/views'

interface DynamoDBContextValue {
  tableRefs: DynamoDBTableRef[]
  loading: boolean
  error: string | null
  refreshTables: () => Promise<void>
  selectTable: (connectionId: string, tableName: string) => void
  selectedTableKey: string | null
  getTableInfo: (connectionId: string, tableName: string) => Promise<DynamoDBTableInfo>
  scanTable: (connectionId: string, tableName: string, options?: DynamoDBScanOptions) => Promise<DynamoDBScanResult>
  queryTable: (connectionId: string, tableName: string, options: DynamoDBQueryOptions) => Promise<DynamoDBScanResult>
  getItem: (connectionId: string, tableName: string, key: Record<string, unknown>) => Promise<Record<string, unknown> | null>
  putItem: (connectionId: string, tableName: string, item: Record<string, unknown>) => Promise<void>
  deleteItem: (connectionId: string, tableName: string, key: Record<string, unknown>) => Promise<void>
  connections: DynamoDBConnectionConfig[]
  connectionStates: Map<string, DynamoDBConnectionState>
  // Effective read-only = manually pinned OR a write was denied at runtime.
  isTableReadOnly: (connectionId: string, tableName: string) => boolean
  toggleTableReadOnly: (connectionId: string, tableName: string) => Promise<void>
  setConnectionEnabled: (id: string, enabled: boolean) => Promise<void>
  saveConnection: (config: DynamoDBConnectionConfig) => Promise<void>
  deleteConnection: (id: string) => Promise<void>
  testConnection: (id: string) => Promise<DynamoDBConnectionState>
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
}

export const DynamoDBContext = createContext<DynamoDBContextValue>({
  tableRefs: [],
  loading: false,
  error: null,
  refreshTables: async () => {},
  selectTable: () => {},
  selectedTableKey: null,
  getTableInfo: async () => ({} as DynamoDBTableInfo),
  scanTable: async () => ({ items: [], count: 0, scannedCount: 0 }),
  queryTable: async () => ({ items: [], count: 0, scannedCount: 0 }),
  getItem: async () => null,
  putItem: async () => {},
  deleteItem: async () => {},
  connections: [],
  connectionStates: new Map(),
  isTableReadOnly: () => false,
  toggleTableReadOnly: async () => {},
  setConnectionEnabled: async () => {},
  saveConnection: async () => {},
  deleteConnection: async () => {},
  testConnection: async () => ({ connectionId: '', isConnected: false }),
  settingsOpen: false,
  setSettingsOpen: () => {},
})

export function useDynamoDB() {
  return useContext(DynamoDBContext)
}

// Encodes a (connection, table) pair into a single view itemId, mirroring the
// SQL view's "table:SCHEMA.TABLE" routing. The same table name can exist on
// multiple connections, so identity is always the pair — never the name alone.
export const encodeTableKey = (connectionId: string, tableName: string) => `${connectionId}::${tableName}`

export const decodeTableKey = (key: string): { connectionId: string; tableName: string } => {
  const sep = key.indexOf('::')
  if (sep === -1) return { connectionId: '', tableName: key }
  return { connectionId: key.slice(0, sep), tableName: key.slice(sep + 2) }
}

export const DynamoDBProvider: FC<PropsWithChildren> = ({ children }) => {
  const [tableRefs, setTableRefs] = useState<DynamoDBTableRef[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTableKey, setSelectedTableKey] = useState<string | null>(null)
  const [connections, setConnections] = useState<DynamoDBConnectionConfig[]>([])
  const [connectionStates, setConnectionStates] = useState<Map<string, DynamoDBConnectionState>>(new Map())
  const [manualReadOnly, setManualReadOnly] = useState<Set<string>>(new Set())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { updateView } = useViews()

  // Kept in a ref so the connection-state subscription can resolve a friendly
  // connection name without re-subscribing on every connections change.
  const connectionsRef = useRef<DynamoDBConnectionConfig[]>([])
  connectionsRef.current = connections

  const loadConnections = useCallback(async () => {
    const conns = await window.electron.getDynamoDBConnections()
    setConnections(conns)
  }, [])

  const loadReadOnlyTables = useCallback(async () => {
    const keys = await window.electron.getDynamoDBReadOnlyTables()
    setManualReadOnly(new Set(keys))
  }, [])

  // A table is read-only if the user pinned it OR a write was denied at runtime.
  const isTableReadOnly = useCallback((connectionId: string, tableName: string) => {
    if (manualReadOnly.has(encodeTableKey(connectionId, tableName))) return true
    return connectionStates.get(connectionId)?.readOnlyTables?.includes(tableName) ?? false
  }, [manualReadOnly, connectionStates])

  const toggleTableReadOnly = useCallback(async (connectionId: string, tableName: string) => {
    const key = encodeTableKey(connectionId, tableName)
    const next = !manualReadOnly.has(key)
    const keys = await window.electron.setDynamoDBTableReadOnly(connectionId, tableName, next)
    setManualReadOnly(new Set(keys))
  }, [manualReadOnly])

  const refreshTables = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const refs = await window.electron.dynamodbListAllTables()
      setTableRefs(refs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tables')
      setTableRefs([])
    } finally {
      setLoading(false)
    }
  }, [])

  const selectTable = useCallback((connectionId: string, tableName: string) => {
    const key = encodeTableKey(connectionId, tableName)
    setSelectedTableKey(key)
    updateView('dynamodb', key)
  }, [updateView])

  const setConnectionEnabled = useCallback(async (id: string, enabled: boolean) => {
    await window.electron.setDynamoDBConnectionEnabled(id, enabled)
    await loadConnections()
  }, [loadConnections])

  const saveConnection = useCallback(async (config: DynamoDBConnectionConfig) => {
    await window.electron.saveDynamoDBConnection(config)
    await loadConnections()
  }, [loadConnections])

  const deleteConnection = useCallback(async (id: string) => {
    await window.electron.deleteDynamoDBConnection(id)
    await loadConnections()
  }, [loadConnections])

  const testConnection = useCallback(async (id: string) => {
    return await window.electron.testDynamoDBConnection(id)
  }, [])

  const getTableInfo = useCallback(async (connectionId: string, tableName: string) => {
    return await window.electron.dynamodbDescribeTable(connectionId, tableName)
  }, [])

  const scanTable = useCallback(async (connectionId: string, tableName: string, options?: DynamoDBScanOptions) => {
    return await window.electron.dynamodbScanTable(connectionId, tableName, options)
  }, [])

  const queryTable = useCallback(async (connectionId: string, tableName: string, options: DynamoDBQueryOptions) => {
    return await window.electron.dynamodbQueryTable(connectionId, tableName, options)
  }, [])

  const getItem = useCallback(async (connectionId: string, tableName: string, key: Record<string, unknown>) => {
    return await window.electron.dynamodbGetItem(connectionId, tableName, key)
  }, [])

  const putItem = useCallback(async (connectionId: string, tableName: string, item: Record<string, unknown>) => {
    return await window.electron.dynamodbPutItem(connectionId, tableName, item)
  }, [])

  const deleteItem = useCallback(async (connectionId: string, tableName: string, key: Record<string, unknown>) => {
    return await window.electron.dynamodbDeleteItem(connectionId, tableName, key)
  }, [])

  // Subscribe to per-connection state changes. The manager emits one state per
  // connection — collect them into a Map and raise a toast on failures.
  useEffect(() => {
    return window.electron.subscribeDynamoDBConnectionState((state) => {
      setConnectionStates((prev) => {
        const next = new Map(prev)
        next.set(state.connectionId, state)
        return next
      })

      const name = connectionsRef.current.find((c) => c.id === state.connectionId)?.name ?? 'DynamoDB'

      if (state.expired) {
        toast.error(`${name}: session expired`, {
          description: 'Paste a fresh session token in Settings.',
          action: { label: 'Open Settings', onClick: () => setSettingsOpen(true) },
        })
      } else if (!state.isConnected && state.lastError) {
        toast.error(name, { description: state.lastError })
      } else if (state.lastError && /not authorized to perform: \w+:(?:Put|Delete|Update|BatchWrite)/i.test(state.lastError)) {
        const table = state.lastError.match(/table\/([^\s"]+)/)?.[1]
        toast.error(`${name}: read-only`, { description: table ? `Write is not permitted on ${table}.` : 'Write is not permitted on this table.' })
      } else if (state.lastError) {
        toast.error(name, { description: state.lastError })
      }
    })
  }, [])

  // Hydrate connections + any already-known states on mount.
  useEffect(() => {
    loadConnections()
    loadReadOnlyTables()
    window.electron.getDynamoDBConnectionStates().then((states) => {
      setConnectionStates(new Map(states.map((s) => [s.connectionId, s])))
    })
  }, [loadConnections, loadReadOnlyTables])

  // Refresh the flat table list whenever the set of connected connections
  // changes — never on mere operation-error emissions.
  const connectedKey = useMemo(
    () =>
      Array.from(connectionStates.values())
        .filter((s) => s.isConnected)
        .map((s) => s.connectionId)
        .sort()
        .join(','),
    [connectionStates]
  )

  useEffect(() => {
    if (connectedKey) {
      refreshTables()
    } else {
      setTableRefs([])
    }
  }, [connectedKey, refreshTables])

  const value = useMemo<DynamoDBContextValue>(() => ({
    tableRefs,
    loading,
    error,
    refreshTables,
    selectTable,
    selectedTableKey,
    getTableInfo,
    scanTable,
    queryTable,
    getItem,
    putItem,
    deleteItem,
    connections,
    connectionStates,
    isTableReadOnly,
    toggleTableReadOnly,
    setConnectionEnabled,
    saveConnection,
    deleteConnection,
    testConnection,
    settingsOpen,
    setSettingsOpen,
  }), [
    tableRefs, loading, error, refreshTables, selectTable, selectedTableKey,
    getTableInfo, scanTable, queryTable, getItem, putItem, deleteItem,
    connections, connectionStates, isTableReadOnly, toggleTableReadOnly,
    setConnectionEnabled, saveConnection,
    deleteConnection, testConnection, settingsOpen,
  ])

  return <DynamoDBContext.Provider value={value}>{children}</DynamoDBContext.Provider>
}
