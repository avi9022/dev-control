import { createContext, useContext, useState, useEffect, useCallback, useRef, type FC, type PropsWithChildren } from 'react'
import { useViews } from '@/ui/contexts/views'
import { toast } from 'sonner'

interface MongoDBContextValue {
  connections: MongoConnectionConfig[]
  activeConnectionId: string | null
  connectionState: MongoConnectionState | null
  isConnected: boolean
  databases: MongoDatabase[]
  selectedDatabase: string | null
  collections: MongoCollection[]
  selectedCollection: string | null
  loading: boolean
  error: string | null
  loadConnections: () => Promise<void>
  saveConnection: (config: MongoConnectionConfig) => Promise<void>
  deleteConnection: (id: string) => Promise<void>
  testConnection: (id?: string) => Promise<MongoConnectionState>
  setActiveConnection: (id: string) => Promise<void>
  disconnect: () => Promise<void>
  refreshDatabases: () => Promise<void>
  selectDatabase: (dbName: string | null) => void
  refreshCollections: () => Promise<void>
  selectCollection: (collectionName: string | null) => void
  createDatabase: (dbName: string, collectionName: string) => Promise<void>
  dropDatabase: (dbName: string) => Promise<void>
  createCollection: (database: string, name: string) => Promise<void>
  dropCollection: (database: string, name: string) => Promise<void>
  renameCollection: (database: string, oldName: string, newName: string) => Promise<void>
  findDocuments: (database: string, collection: string, query: Record<string, unknown>, options?: MongoFindOptions) => Promise<MongoFindResult>
  findDocumentById: (database: string, collection: string, id: string) => Promise<Record<string, unknown> | null>
  insertDocument: (database: string, collection: string, document: Record<string, unknown>) => Promise<void>
  updateDocument: (database: string, collection: string, id: string, update: Record<string, unknown>) => Promise<void>
  deleteDocument: (database: string, collection: string, id: string) => Promise<void>
  insertMany: (database: string, collection: string, documents: Record<string, unknown>[]) => Promise<void>
  deleteMany: (database: string, collection: string, filter: Record<string, unknown>) => Promise<void>
  explainQuery: (database: string, collection: string, query: Record<string, unknown>) => Promise<MongoExplainResult>
  runAggregation: (database: string, collection: string, pipeline: Record<string, unknown>[]) => Promise<Record<string, unknown>[]>
  analyzeSchema: (database: string, collection: string) => Promise<MongoSchemaAnalysis>
  getIndexes: (database: string, collection: string) => Promise<MongoIndex[]>
  createIndex: (database: string, collection: string, keys: Record<string, unknown>, options?: MongoIndexOptions) => Promise<void>
  dropIndex: (database: string, collection: string, indexName: string) => Promise<void>
  getValidationRules: (database: string, collection: string) => Promise<MongoValidationRules>
  setValidationRules: (database: string, collection: string, rules: MongoValidationRules) => Promise<void>
  exportCollection: (database: string, collection: string, format: string) => Promise<string>
  importDocuments: (database: string, collection: string, data: string, format: string) => Promise<void>
  getSavedQueries: () => Promise<MongoSavedQuery[]>
  saveQuery: (query: MongoSavedQuery) => Promise<void>
  deleteSavedQuery: (id: string) => Promise<void>
}

export const MongoDBContext = createContext<MongoDBContextValue>({
  connections: [],
  activeConnectionId: null,
  connectionState: null,
  isConnected: false,
  databases: [],
  selectedDatabase: null,
  collections: [],
  selectedCollection: null,
  loading: false,
  error: null,
  loadConnections: async () => {},
  saveConnection: async () => {},
  deleteConnection: async () => {},
  testConnection: async () => ({ connectionId: '', status: 'disconnected' }) as MongoConnectionState,
  setActiveConnection: async () => {},
  disconnect: async () => {},
  refreshDatabases: async () => {},
  selectDatabase: () => {},
  refreshCollections: async () => {},
  selectCollection: () => {},
  createDatabase: async () => {},
  dropDatabase: async () => {},
  createCollection: async () => {},
  dropCollection: async () => {},
  renameCollection: async () => {},
  findDocuments: async () => ({ documents: [], count: 0, totalCount: 0 }) as MongoFindResult,
  findDocumentById: async () => null,
  insertDocument: async () => {},
  updateDocument: async () => {},
  deleteDocument: async () => {},
  insertMany: async () => {},
  deleteMany: async () => {},
  explainQuery: async () => ({}) as MongoExplainResult,
  runAggregation: async () => [],
  analyzeSchema: async () => ({}) as MongoSchemaAnalysis,
  getIndexes: async () => [],
  createIndex: async () => {},
  dropIndex: async () => {},
  getValidationRules: async () => ({}) as MongoValidationRules,
  setValidationRules: async () => {},
  exportCollection: async () => '',
  importDocuments: async () => {},
  getSavedQueries: async () => [],
  saveQuery: async () => {},
  deleteSavedQuery: async () => {},
})

export function useMongoDB() {
  return useContext(MongoDBContext)
}

export const MongoDBProvider: FC<PropsWithChildren> = ({ children }) => {
  const [connections, setConnections] = useState<MongoConnectionConfig[]>([])
  const [activeConnectionId, setActiveConnectionIdState] = useState<string | null>(null)
  const [connectionState, setConnectionState] = useState<MongoConnectionState | null>(null)
  const [databases, setDatabases] = useState<MongoDatabase[]>([])
  const [selectedDatabase, setSelectedDatabase] = useState<string | null>(null)
  const [collections, setCollections] = useState<MongoCollection[]>([])
  const [selectedCollection, setSelectedCollectionState] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { updateView } = useViews()

  const isConnected = connectionState?.status === 'connected'

  const loadConnections = useCallback(async () => {
    const conns = await window.electron.mongoGetConnections()
    setConnections(conns)
    const activeId = await window.electron.mongoGetActiveConnectionId()
    setActiveConnectionIdState(activeId)
  }, [])

  const saveConnection = useCallback(async (config: MongoConnectionConfig) => {
    await window.electron.mongoSaveConnection(config)
    await loadConnections()
  }, [loadConnections])

  const deleteConnection = useCallback(async (id: string) => {
    await window.electron.mongoDeleteConnection(id)
    await loadConnections()
  }, [loadConnections])

  const testConnection = useCallback(async (id?: string) => {
    const targetId = id || activeConnectionId
    if (!targetId) {
      return { connectionId: '', status: 'disconnected', error: 'No connection' } as MongoConnectionState
    }
    return await window.electron.mongoTestConnection(targetId)
  }, [activeConnectionId])

  const setActiveConnection = useCallback(async (id: string) => {
    await window.electron.mongoSetActiveConnection(id)
    setActiveConnectionIdState(id)
  }, [])

  const disconnect = useCallback(async () => {
    await window.electron.mongoDisconnect()
    setActiveConnectionIdState(null)
    setConnectionState(null)
    setDatabases([])
    setCollections([])
    setSelectedDatabase(null)
    setSelectedCollectionState(null)
  }, [])

  const refreshDatabases = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const dbList = await window.electron.mongoGetDatabases()
      setDatabases(dbList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load databases')
      setDatabases([])
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshCollections = useCallback(async () => {
    if (!selectedDatabase) {
      setCollections([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const collectionList = await window.electron.mongoGetCollections(selectedDatabase)
      setCollections(collectionList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load collections')
      setCollections([])
    } finally {
      setLoading(false)
    }
  }, [selectedDatabase])

  const selectDatabase = useCallback((dbName: string | null) => {
    setSelectedDatabase(dbName)
    setSelectedCollectionState(null)
    setCollections([])
  }, [])

  const selectCollection = useCallback((collectionName: string | null) => {
    setSelectedCollectionState(collectionName)
    updateView('mongodb', collectionName)
  }, [updateView])

  const createDatabase = useCallback(async (dbName: string, collectionName: string) => {
    await window.electron.mongoCreateDatabase(dbName, collectionName)
    await refreshDatabases()
  }, [refreshDatabases])

  const dropDatabase = useCallback(async (dbName: string) => {
    await window.electron.mongoDropDatabase(dbName)
    if (selectedDatabase === dbName) {
      setSelectedDatabase(null)
      setSelectedCollectionState(null)
      setCollections([])
    }
    await refreshDatabases()
  }, [refreshDatabases, selectedDatabase])

  const createCollectionOp = useCallback(async (database: string, name: string) => {
    await window.electron.mongoCreateCollection(database, name)
    await refreshDatabases()
    if (database === selectedDatabase) {
      await refreshCollections()
    }
  }, [refreshDatabases, refreshCollections, selectedDatabase])

  const dropCollectionOp = useCallback(async (database: string, name: string) => {
    await window.electron.mongoDropCollection(database, name)
    if (selectedDatabase === database && selectedCollection === name) {
      setSelectedCollectionState(null)
    }
    await refreshDatabases()
    if (database === selectedDatabase) {
      await refreshCollections()
    }
  }, [refreshDatabases, refreshCollections, selectedDatabase, selectedCollection])

  const renameCollectionOp = useCallback(async (database: string, oldName: string, newName: string) => {
    await window.electron.mongoRenameCollection(database, oldName, newName)
    if (selectedDatabase === database && selectedCollection === oldName) {
      setSelectedCollectionState(newName)
      updateView('mongodb', newName)
    }
    await refreshDatabases()
    if (database === selectedDatabase) {
      await refreshCollections()
    }
  }, [refreshDatabases, refreshCollections, selectedDatabase, selectedCollection, updateView])

  const findDocuments = useCallback(async (database: string, collection: string, query: Record<string, unknown>, options?: MongoFindOptions) => {
    return await window.electron.mongoFindDocuments(database, collection, query, options)
  }, [])

  const findDocumentById = useCallback(async (database: string, collection: string, id: string) => {
    return await window.electron.mongoFindDocumentById(database, collection, id)
  }, [])

  const insertDocument = useCallback(async (database: string, collection: string, document: Record<string, unknown>) => {
    await window.electron.mongoInsertDocument(database, collection, document)
  }, [])

  const updateDocument = useCallback(async (database: string, collection: string, id: string, update: Record<string, unknown>) => {
    await window.electron.mongoUpdateDocument(database, collection, id, update)
  }, [])

  const deleteDocument = useCallback(async (database: string, collection: string, id: string) => {
    await window.electron.mongoDeleteDocument(database, collection, id)
  }, [])

  const insertMany = useCallback(async (database: string, collection: string, documents: Record<string, unknown>[]) => {
    await window.electron.mongoInsertMany(database, collection, documents)
  }, [])

  const deleteMany = useCallback(async (database: string, collection: string, filter: Record<string, unknown>) => {
    await window.electron.mongoDeleteMany(database, collection, filter)
  }, [])

  const explainQuery = useCallback(async (database: string, collection: string, query: Record<string, unknown>) => {
    return await window.electron.mongoExplainQuery(database, collection, query)
  }, [])

  const runAggregation = useCallback(async (database: string, collection: string, pipeline: Record<string, unknown>[]) => {
    return await window.electron.mongoRunAggregation(database, collection, pipeline)
  }, [])

  const analyzeSchema = useCallback(async (database: string, collection: string) => {
    return await window.electron.mongoAnalyzeSchema(database, collection)
  }, [])

  const getIndexes = useCallback(async (database: string, collection: string) => {
    return await window.electron.mongoGetIndexes(database, collection)
  }, [])

  const createIndex = useCallback(async (database: string, collection: string, keys: Record<string, unknown>, options?: MongoIndexOptions) => {
    await window.electron.mongoCreateIndex(database, collection, keys, options)
  }, [])

  const dropIndex = useCallback(async (database: string, collection: string, indexName: string) => {
    await window.electron.mongoDropIndex(database, collection, indexName)
  }, [])

  const getValidationRules = useCallback(async (database: string, collection: string) => {
    return await window.electron.mongoGetValidationRules(database, collection)
  }, [])

  const setValidationRules = useCallback(async (database: string, collection: string, rules: MongoValidationRules) => {
    await window.electron.mongoSetValidationRules(database, collection, rules)
  }, [])

  const exportCollection = useCallback(async (database: string, collection: string, format: string) => {
    return await window.electron.mongoExportCollection(database, collection, format)
  }, [])

  const importDocuments = useCallback(async (database: string, collection: string, data: string, format: string) => {
    await window.electron.mongoImportDocuments(database, collection, data, format)
  }, [])

  const getSavedQueries = useCallback(async () => {
    return await window.electron.mongoGetSavedQueries()
  }, [])

  const saveQuery = useCallback(async (query: MongoSavedQuery) => {
    await window.electron.mongoSaveQuery(query)
  }, [])

  const deleteSavedQuery = useCallback(async (id: string) => {
    await window.electron.mongoDeleteSavedQuery(id)
  }, [])

  const connectionsRef = useRef(connections)
  connectionsRef.current = connections

  // Subscribe to connection state changes
  useEffect(() => {
    return window.electron.subscribeMongoConnectionState((state) => {
      setConnectionState(state)
      if (state.status === 'error') {
        const conn = connectionsRef.current.find((c) => c.id === state.connectionId)
        const connName = conn?.name ?? 'MongoDB'
        toast.error(connName, {
          description: state.error ?? 'Authentication failed.',
        })
      }
    })
  }, [])

  // Load connections on mount
  useEffect(() => {
    loadConnections()
  }, [loadConnections])

  // Refresh databases when connection state changes to connected
  useEffect(() => {
    if (isConnected) {
      refreshDatabases()
    } else {
      setDatabases([])
      setCollections([])
      setSelectedDatabase(null)
      setSelectedCollectionState(null)
    }
  }, [isConnected, refreshDatabases])

  // Refresh collections when selected database changes
  useEffect(() => {
    if (selectedDatabase && isConnected) {
      refreshCollections()
    }
  }, [selectedDatabase, isConnected, refreshCollections])

  return (
    <MongoDBContext.Provider
      value={{
        connections,
        activeConnectionId,
        connectionState,
        isConnected,
        databases,
        selectedDatabase,
        collections,
        selectedCollection,
        loading,
        error,
        loadConnections,
        saveConnection,
        deleteConnection,
        testConnection,
        setActiveConnection,
        disconnect,
        refreshDatabases,
        selectDatabase,
        refreshCollections,
        selectCollection,
        createDatabase,
        dropDatabase,
        createCollection: createCollectionOp,
        dropCollection: dropCollectionOp,
        renameCollection: renameCollectionOp,
        findDocuments,
        findDocumentById,
        insertDocument,
        updateDocument,
        deleteDocument,
        insertMany,
        deleteMany,
        explainQuery,
        runAggregation,
        analyzeSchema,
        getIndexes,
        createIndex,
        dropIndex,
        getValidationRules,
        setValidationRules,
        exportCollection,
        importDocuments,
        getSavedQueries,
        saveQuery,
        deleteSavedQuery,
      }}
    >
      {children}
    </MongoDBContext.Provider>
  )
}
