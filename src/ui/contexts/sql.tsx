import { createContext, useContext, useState, useEffect, useCallback, useRef, type FC, type PropsWithChildren } from 'react'
import { useViews } from '@/ui/contexts/views'
import { toast } from 'sonner'

function createEmptyWorksheetState(): SQLWorksheetState {
  return {
    executing: false,
    lastResult: null,
    scriptResult: null,
    explainResult: null,
    messages: [],
    dbmsOutput: [],
  }
}

interface SQLContextValue {
  connections: SQLConnectionConfig[]
  activeConnectionId: string | null
  connectionState: SQLConnectionState | null
  isConnected: boolean
  schemas: string[]
  selectedSchema: string | null
  tables: SQLTableInfo[]
  views: SQLViewInfo[]
  sequences: SQLSequenceInfo[]
  procedures: SQLProcedureInfo[]
  functions: SQLFunctionInfo[]
  packages: SQLPackageInfo[]
  triggers: SQLTriggerInfo[]
  worksheets: SQLWorksheet[]
  activeWorksheetId: string | null
  executing: boolean
  lastResult: SQLQueryResult | null
  scriptResult: SQLScriptResult | null
  explainResult: SQLExplainPlan | null
  queryHistory: SQLHistoryEntry[]
  savedQueries: SQLSavedQuery[]
  messages: SQLMessage[]
  dbmsOutput: string[]
  columnMap: Record<string, string[]>
  loading: boolean

  saveConnection: (config: SQLConnectionConfig) => Promise<void>
  deleteConnection: (id: string) => Promise<void>
  testConnection: (id: string) => Promise<SQLConnectionState>
  setActiveConnection: (id: string) => Promise<void>
  disconnect: () => Promise<void>
  selectSchema: (schema: string) => Promise<void>
  refreshSchema: () => Promise<void>
  loadSchemas: (includeSystem?: boolean) => Promise<void>
  executeQuery: (sql: string, params?: unknown[]) => Promise<SQLQueryResult>
  executeScript: (sql: string) => Promise<SQLScriptResult>
  cancelQuery: (queryId: string) => Promise<void>
  explainPlan: (sql: string) => Promise<SQLExplainPlan>
  explainPlanForWorksheet: (sql: string) => Promise<SQLExplainPlan>
  enableDbmsOutput: () => Promise<void>
  getDbmsOutput: () => Promise<string[]>
  commit: () => Promise<void>
  rollback: () => Promise<void>
  getTableColumns: (schema: string, table: string) => Promise<SQLColumnDetail[]>
  getTableConstraints: (schema: string, table: string) => Promise<SQLConstraint[]>
  getTableIndexes: (schema: string, table: string) => Promise<SQLIndex[]>
  getTableTriggers: (schema: string, table: string) => Promise<SQLTriggerInfo[]>
  getObjectDDL: (schema: string, objectName: string, objectType: string) => Promise<string>
  getTableRowCount: (schema: string, table: string) => Promise<number>
  describeObject: (schema: string, name: string) => Promise<SQLObjectDescription>
  loadHistory: () => Promise<void>
  clearHistory: () => Promise<void>
  loadSavedQueries: () => Promise<void>
  saveQuery: (query: SQLSavedQuery) => Promise<void>
  deleteSavedQuery: (id: string) => Promise<void>
  addWorksheet: () => void
  removeWorksheet: (id: string) => void
  setActiveWorksheet: (id: string) => void
  updateWorksheetSql: (id: string, sql: string) => void
  renameWorksheet: (id: string, name: string) => void
  addMessage: (message: SQLMessage) => void
  clearMessages: () => void
  setEditorSqlAndExecute: (sql: string) => void
  setEditorSql: (sql: string) => void
  patchResultCell: (rowIdx: number, colIdx: number, newValue: unknown) => void
  isWorksheetExecuting: (id: string) => boolean
}

const defaultWorksheet: SQLWorksheet = {
  id: crypto.randomUUID(),
  name: 'Sheet 1',
  sql: '',
  connectionId: '',
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

export const SQLContext = createContext<SQLContextValue>({
  connections: [],
  activeConnectionId: null,
  connectionState: null,
  isConnected: false,
  schemas: [],
  selectedSchema: null,
  tables: [],
  views: [],
  sequences: [],
  procedures: [],
  functions: [],
  packages: [],
  triggers: [],
  worksheets: [defaultWorksheet],
  activeWorksheetId: defaultWorksheet.id,
  executing: false,
  lastResult: null,
  scriptResult: null,
  explainResult: null,
  queryHistory: [],
  savedQueries: [],
  messages: [],
  dbmsOutput: [],
  columnMap: {},
  loading: false,
  saveConnection: async () => {},
  deleteConnection: async () => {},
  testConnection: async () => ({ connectionId: '', status: 'disconnected' }) as SQLConnectionState,
  setActiveConnection: async () => {},
  disconnect: async () => {},
  selectSchema: async () => {},
  refreshSchema: async () => {},
  loadSchemas: async () => {},
  executeQuery: async () => ({}) as SQLQueryResult,
  executeScript: async () => ({}) as SQLScriptResult,
  cancelQuery: async () => {},
  explainPlan: async () => ({}) as SQLExplainPlan,
  explainPlanForWorksheet: async () => ({}) as SQLExplainPlan,
  enableDbmsOutput: async () => {},
  getDbmsOutput: async () => [],
  commit: async () => {},
  rollback: async () => {},
  getTableColumns: async () => [],
  getTableConstraints: async () => [],
  getTableIndexes: async () => [],
  getTableTriggers: async () => [],
  getObjectDDL: async () => '',
  getTableRowCount: async () => 0,
  describeObject: async () => ({}) as SQLObjectDescription,
  loadHistory: async () => {},
  clearHistory: async () => {},
  loadSavedQueries: async () => {},
  saveQuery: async () => {},
  deleteSavedQuery: async () => {},
  addWorksheet: () => {},
  removeWorksheet: () => {},
  setActiveWorksheet: () => {},
  updateWorksheetSql: () => {},
  renameWorksheet: () => {},
  addMessage: () => {},
  clearMessages: () => {},
  setEditorSqlAndExecute: () => {},
  setEditorSql: () => {},
  patchResultCell: () => {},
  isWorksheetExecuting: () => false,
})

export function useSQL() {
  return useContext(SQLContext)
}

export const SQLProvider: FC<PropsWithChildren> = ({ children }) => {
  const [connections, setConnections] = useState<SQLConnectionConfig[]>([])
  const [activeConnectionId, setActiveConnectionIdState] = useState<string | null>(null)
  const [connectionState, setConnectionState] = useState<SQLConnectionState | null>(null)
  const [schemas, setSchemas] = useState<string[]>([])
  const [selectedSchema, setSelectedSchema] = useState<string | null>(null)
  const [tables, setTables] = useState<SQLTableInfo[]>([])
  const [viewsList, setViewsList] = useState<SQLViewInfo[]>([])
  const [sequences, setSequences] = useState<SQLSequenceInfo[]>([])
  const [procedures, setProcedures] = useState<SQLProcedureInfo[]>([])
  const [functions, setFunctions] = useState<SQLFunctionInfo[]>([])
  const [packages, setPackages] = useState<SQLPackageInfo[]>([])
  const [triggersList, setTriggersList] = useState<SQLTriggerInfo[]>([])
  const [worksheets, setWorksheets] = useState<SQLWorksheet[]>([defaultWorksheet])
  const [activeWorksheetId, setActiveWorksheetId] = useState<string | null>(defaultWorksheet.id)
  const [worksheetStates, setWorksheetStates] = useState<Record<string, SQLWorksheetState>>({
    [defaultWorksheet.id]: createEmptyWorksheetState(),
  })
  const [queryHistory, setQueryHistory] = useState<SQLHistoryEntry[]>([])
  const [savedQueries, setSavedQueries] = useState<SQLSavedQuery[]>([])
  const [columnMap, setColumnMap] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)
  const { updateView } = useViews()

  const isConnected = connectionState?.status === 'connected'

  // Derive active worksheet state
  const activeWsState = activeWorksheetId
    ? worksheetStates[activeWorksheetId] ?? createEmptyWorksheetState()
    : createEmptyWorksheetState()

  const executing = activeWsState.executing
  const lastResult = activeWsState.lastResult
  const scriptResult = activeWsState.scriptResult
  const explainResult = activeWsState.explainResult
  const messages = activeWsState.messages
  const dbmsOutput = activeWsState.dbmsOutput

  // Per-worksheet state updater
  const updateWsState = useCallback(
    (wsId: string, updater: (prev: SQLWorksheetState) => SQLWorksheetState) => {
      setWorksheetStates((prev) => ({
        ...prev,
        [wsId]: updater(prev[wsId] ?? createEmptyWorksheetState()),
      }))
    }, []
  )

  // Ref to track activeWorksheetId in closures
  const activeWorksheetIdRef = useRef(activeWorksheetId)
  activeWorksheetIdRef.current = activeWorksheetId

  const loadConnections = useCallback(async () => {
    const conns = await window.electron.sqlGetConnections()
    setConnections(conns)
    const activeId = await window.electron.sqlGetActiveConnectionId()
    setActiveConnectionIdState(activeId)
  }, [])

  const saveConnection = useCallback(async (config: SQLConnectionConfig) => {
    await window.electron.sqlSaveConnection(config)
    await loadConnections()
  }, [loadConnections])

  const deleteConnection = useCallback(async (id: string) => {
    await window.electron.sqlDeleteConnection(id)
    await loadConnections()
  }, [loadConnections])

  const testConnection = useCallback(async (id: string) => {
    return await window.electron.sqlTestConnection(id)
  }, [])

  const setActiveConnection = useCallback(async (id: string) => {
    await window.electron.sqlSetActiveConnection(id)
    setActiveConnectionIdState(id)
  }, [])

  const disconnect = useCallback(async () => {
    await window.electron.sqlDisconnect()
    setActiveConnectionIdState(null)
    setConnectionState(null)
    setSchemas([])
    setSelectedSchema(null)
    setTables([])
    setViewsList([])
    setSequences([])
    setProcedures([])
    setFunctions([])
    setPackages([])
    setTriggersList([])
  }, [])

  const loadSchemaObjects = useCallback(async (schema: string) => {
    setLoading(true)
    try {
      const [t, v, s, p, f, pk, tr, colMap] = await Promise.all([
        window.electron.sqlGetTables(schema),
        window.electron.sqlGetViews(schema),
        window.electron.sqlGetSequences(schema),
        window.electron.sqlGetProcedures(schema),
        window.electron.sqlGetFunctions(schema),
        window.electron.sqlGetPackages(schema),
        window.electron.sqlGetTriggers(schema),
        window.electron.sqlGetSchemaColumnMap(schema),
      ])
      setTables(t)
      setViewsList(v)
      setSequences(s)
      setProcedures(p)
      setFunctions(f)
      setPackages(pk)
      setTriggersList(tr)
      setColumnMap(colMap)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load schema objects'
      toast.error('Schema Error', { description: msg })
    } finally {
      setLoading(false)
    }
  }, [])

  const selectSchema = useCallback(async (schema: string) => {
    setSelectedSchema(schema)
    await loadSchemaObjects(schema)
  }, [loadSchemaObjects])

  const refreshSchema = useCallback(async () => {
    if (!selectedSchema) return
    await loadSchemaObjects(selectedSchema)
  }, [selectedSchema, loadSchemaObjects])

  const loadSchemas = useCallback(async (includeSystem?: boolean) => {
    try {
      const s = await window.electron.sqlGetSchemas(includeSystem)
      setSchemas(s)
    } catch {
      setSchemas([])
    }
  }, [])

  const addMessage = useCallback((message: SQLMessage) => {
    const wsId = activeWorksheetIdRef.current
    if (!wsId) return
    updateWsState(wsId, (prev) => ({
      ...prev,
      messages: [...prev.messages, message],
    }))
  }, [updateWsState])

  const clearMessages = useCallback(() => {
    const wsId = activeWorksheetIdRef.current
    if (!wsId) return
    updateWsState(wsId, (prev) => ({
      ...prev,
      messages: [],
    }))
  }, [updateWsState])

  const executeQuery = useCallback(async (sql: string, params?: unknown[]) => {
    const wsId = activeWorksheetIdRef.current
    if (!wsId) throw new Error('No active worksheet')
    updateWsState(wsId, (prev) => ({ ...prev, executing: true }))
    try {
      const result = await window.electron.sqlExecuteQuery(sql, params)
      updateWsState(wsId, (prev) => ({
        ...prev,
        executing: false,
        lastResult: result,
        messages: [...prev.messages, {
          id: crypto.randomUUID(),
          type: 'success' as const,
          text: `${result.type} executed: ${result.rowCount} rows${result.executionTime ? ` in ${result.executionTime}ms` : ''}`,
          timestamp: Date.now(),
        }],
      }))
      // Update lastExecutedSql on the worksheet for dirty tracking
      setWorksheets((prev) =>
        prev.map((w) => (w.id === wsId ? { ...w, lastExecutedSql: sql, updatedAt: Date.now() } : w))
      )
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Query execution failed'
      updateWsState(wsId, (prev) => ({
        ...prev,
        executing: false,
        messages: [...prev.messages, {
          id: crypto.randomUUID(),
          type: 'error' as const,
          text: msg,
          timestamp: Date.now(),
        }],
      }))
      throw err
    }
  }, [updateWsState])

  const executeScript = useCallback(async (sql: string) => {
    const wsId = activeWorksheetIdRef.current
    if (!wsId) throw new Error('No active worksheet')
    updateWsState(wsId, (prev) => ({ ...prev, executing: true }))
    try {
      const result = await window.electron.sqlExecuteScript(sql)
      const lastSelect = result.results.length > 0
        ? [...result.results].reverse().find((r) => r.type === 'SELECT') ?? null
        : null
      updateWsState(wsId, (prev) => ({
        ...prev,
        executing: false,
        scriptResult: result,
        lastResult: lastSelect ?? prev.lastResult,
        messages: [...prev.messages, {
          id: crypto.randomUUID(),
          type: 'success' as const,
          text: `Script executed: ${result.results.length} statements in ${result.totalExecutionTime}ms`,
          timestamp: Date.now(),
        }],
      }))
      setWorksheets((prev) =>
        prev.map((w) => (w.id === wsId ? { ...w, lastExecutedSql: sql, updatedAt: Date.now() } : w))
      )
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Script execution failed'
      updateWsState(wsId, (prev) => ({
        ...prev,
        executing: false,
        messages: [...prev.messages, {
          id: crypto.randomUUID(),
          type: 'error' as const,
          text: msg,
          timestamp: Date.now(),
        }],
      }))
      throw err
    }
  }, [updateWsState])

  const cancelQuery = useCallback(async (queryId: string) => {
    const wsId = activeWorksheetIdRef.current
    await window.electron.sqlCancelQuery(queryId)
    if (wsId) {
      updateWsState(wsId, (prev) => ({
        ...prev,
        executing: false,
        messages: [...prev.messages, {
          id: crypto.randomUUID(),
          type: 'warning' as const,
          text: 'Query cancelled',
          timestamp: Date.now(),
        }],
      }))
    }
  }, [updateWsState])

  const explainPlan = useCallback(async (sql: string) => {
    return await window.electron.sqlExplainPlan(sql)
  }, [])

  const explainPlanForWorksheet = useCallback(async (sql: string) => {
    const wsId = activeWorksheetIdRef.current
    if (!wsId) throw new Error('No active worksheet')
    try {
      const plan = await window.electron.sqlExplainPlan(sql)
      updateWsState(wsId, (prev) => ({
        ...prev,
        explainResult: plan,
      }))
      return plan
    } catch (err) {
      updateWsState(wsId, (prev) => ({
        ...prev,
        messages: [...prev.messages, {
          id: crypto.randomUUID(),
          type: 'error' as const,
          text: err instanceof Error ? err.message : 'Explain plan failed',
          timestamp: Date.now(),
        }],
      }))
      throw err
    }
  }, [updateWsState])

  const enableDbmsOutput = useCallback(async () => {
    await window.electron.sqlEnableDbmsOutput()
  }, [])

  const getDbmsOutputFn = useCallback(async () => {
    const wsId = activeWorksheetIdRef.current
    const output = await window.electron.sqlGetDbmsOutput()
    if (wsId && output.length > 0) {
      updateWsState(wsId, (prev) => ({
        ...prev,
        dbmsOutput: [...prev.dbmsOutput, ...output],
      }))
    }
    return output
  }, [updateWsState])

  const commit = useCallback(async () => {
    await window.electron.sqlExecuteQuery('COMMIT')
    addMessage({
      id: crypto.randomUUID(),
      type: 'success',
      text: 'Transaction committed',
      timestamp: Date.now(),
    })
  }, [addMessage])

  const rollback = useCallback(async () => {
    await window.electron.sqlExecuteQuery('ROLLBACK')
    addMessage({
      id: crypto.randomUUID(),
      type: 'warning',
      text: 'Transaction rolled back',
      timestamp: Date.now(),
    })
  }, [addMessage])

  const getTableColumns = useCallback(async (schema: string, table: string) => {
    return await window.electron.sqlGetTableColumns(schema, table)
  }, [])

  const getTableConstraints = useCallback(async (schema: string, table: string) => {
    return await window.electron.sqlGetTableConstraints(schema, table)
  }, [])

  const getTableIndexes = useCallback(async (schema: string, table: string) => {
    return await window.electron.sqlGetTableIndexes(schema, table)
  }, [])

  const getTableTriggers = useCallback(async (schema: string, table: string) => {
    return await window.electron.sqlGetTableTriggers(schema, table)
  }, [])

  const getObjectDDL = useCallback(async (schema: string, objectName: string, objectType: string) => {
    return await window.electron.sqlGetObjectDDL(schema, objectName, objectType)
  }, [])

  const getTableRowCount = useCallback(async (schema: string, table: string) => {
    return await window.electron.sqlGetTableRowCount(schema, table)
  }, [])

  const describeObject = useCallback(async (schema: string, name: string) => {
    return await window.electron.sqlDescribeObject(schema, name)
  }, [])

  const loadHistory = useCallback(async () => {
    try {
      const history = await window.electron.sqlGetHistory()
      setQueryHistory(history)
    } catch {
      setQueryHistory([])
    }
  }, [])

  const clearHistory = useCallback(async () => {
    await window.electron.sqlClearHistory()
    setQueryHistory([])
  }, [])

  const loadSavedQueries = useCallback(async () => {
    try {
      const queries = await window.electron.sqlGetSavedQueries()
      setSavedQueries(queries)
    } catch {
      setSavedQueries([])
    }
  }, [])

  const saveQuery = useCallback(async (query: SQLSavedQuery) => {
    await window.electron.sqlSaveQuery(query)
    await loadSavedQueries()
  }, [loadSavedQueries])

  const deleteSavedQuery = useCallback(async (id: string) => {
    await window.electron.sqlDeleteSavedQuery(id)
    await loadSavedQueries()
  }, [loadSavedQueries])

  const addWorksheet = useCallback(() => {
    const count = worksheets.length + 1
    const ws: SQLWorksheet = {
      id: crypto.randomUUID(),
      name: `Sheet ${count}`,
      sql: '',
      connectionId: activeConnectionId ?? '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setWorksheets((prev) => [...prev, ws])
    setWorksheetStates((prev) => ({
      ...prev,
      [ws.id]: createEmptyWorksheetState(),
    }))
    setActiveWorksheetId(ws.id)
  }, [worksheets.length, activeConnectionId])

  const removeWorksheet = useCallback((id: string) => {
    setWorksheetStates((prev) => {
      const { [id]: _, ...rest } = prev
      return rest
    })
    setWorksheets((prev) => {
      const filtered = prev.filter((w) => w.id !== id)
      if (filtered.length === 0) {
        const ws: SQLWorksheet = {
          id: crypto.randomUUID(),
          name: 'Sheet 1',
          sql: '',
          connectionId: activeConnectionId ?? '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        setWorksheetStates((prevStates) => ({
          ...prevStates,
          [ws.id]: createEmptyWorksheetState(),
        }))
        setActiveWorksheetId(ws.id)
        return [ws]
      }
      if (activeWorksheetIdRef.current === id) {
        setActiveWorksheetId(filtered[0].id)
      }
      return filtered
    })
  }, [activeConnectionId])

  const setActiveWorksheetFn = useCallback((id: string) => {
    setActiveWorksheetId(id)
  }, [])

  const updateWorksheetSql = useCallback((id: string, sql: string) => {
    setWorksheets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, sql, updatedAt: Date.now() } : w))
    )
  }, [])

  const renameWorksheet = useCallback((id: string, name: string) => {
    setWorksheets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, name, updatedAt: Date.now() } : w))
    )
  }, [])

  const setEditorSql = useCallback((sql: string) => {
    if (activeWorksheetId) {
      setWorksheets((prev) =>
        prev.map((w) => (w.id === activeWorksheetId ? { ...w, sql, updatedAt: Date.now() } : w))
      )
    }
    updateView('sql' as never, null)
  }, [activeWorksheetId, updateView])

  const setEditorSqlAndExecute = useCallback((sql: string) => {
    const wsId = activeWorksheetIdRef.current
    setEditorSql(sql)
    setTimeout(async () => {
      const targetWsId = wsId ?? activeWorksheetIdRef.current
      if (!targetWsId) return
      updateWsState(targetWsId, (prev) => ({ ...prev, executing: true }))
      try {
        const result = await window.electron.sqlExecuteQuery(sql)
        updateWsState(targetWsId, (prev) => ({
          ...prev,
          executing: false,
          lastResult: result,
          messages: [...prev.messages, {
            id: crypto.randomUUID(),
            type: 'success' as const,
            text: `${result.type} executed: ${result.rowCount} rows${result.executionTime ? ` in ${result.executionTime}ms` : ''}`,
            timestamp: Date.now(),
          }],
        }))
        setWorksheets((prev) =>
          prev.map((w) => (w.id === targetWsId ? { ...w, lastExecutedSql: sql, updatedAt: Date.now() } : w))
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Query execution failed'
        updateWsState(targetWsId, (prev) => ({
          ...prev,
          executing: false,
          messages: [...prev.messages, {
            id: crypto.randomUUID(),
            type: 'error' as const,
            text: msg,
            timestamp: Date.now(),
          }],
        }))
      }
    }, 50)
  }, [setEditorSql, updateWsState])

  const patchResultCell = useCallback((rowIdx: number, colIdx: number, newValue: unknown) => {
    const wsId = activeWorksheetIdRef.current
    if (!wsId) return
    updateWsState(wsId, (prev) => {
      if (!prev.lastResult) return prev
      return {
        ...prev,
        lastResult: {
          ...prev.lastResult,
          rows: prev.lastResult.rows.map((row, i) =>
            i === rowIdx ? row.map((cell, j) => (j === colIdx ? newValue : cell)) : row
          ),
        },
      }
    })
  }, [updateWsState])

  const isWorksheetExecuting = useCallback((id: string) => {
    return worksheetStates[id]?.executing ?? false
  }, [worksheetStates])

  const connectionsRef = useRef(connections)
  connectionsRef.current = connections

  useEffect(() => {
    return window.electron.subscribeSQLConnectionState((state) => {
      setConnectionState(state)
      if (state.status === 'connected' && state.currentSchema) {
        setSelectedSchema(state.currentSchema)
      }
      if (state.status === 'error') {
        const conn = connectionsRef.current.find((c) => c.id === state.connectionId)
        const connName = conn?.name ?? 'Oracle SQL'
        toast.error(connName, {
          description: state.error ?? 'Connection failed.',
        })
      }
    })
  }, [])

  useEffect(() => {
    loadConnections()
  }, [loadConnections])

  useEffect(() => {
    if (isConnected) {
      window.electron.sqlGetSchemas().then((schemas) => {
        setSchemas(schemas)
        const activeConn = connections.find((c) => c.id === activeConnectionId)
        if (activeConn) {
          const userSchema = activeConn.username.toUpperCase()
          if (schemas.includes(userSchema)) {
            setSelectedSchema(userSchema)
          }
        }
      }).catch(() => setSchemas([]))
      loadHistory()
      loadSavedQueries()
    } else {
      setSchemas([])
      setTables([])
      setViewsList([])
      setSequences([])
      setProcedures([])
      setFunctions([])
      setPackages([])
      setTriggersList([])
      setSelectedSchema(null)
    }
  }, [isConnected, loadHistory, loadSavedQueries, connections, activeConnectionId])

  useEffect(() => {
    if (selectedSchema && isConnected) {
      loadSchemaObjects(selectedSchema)
    }
  }, [selectedSchema, isConnected, loadSchemaObjects])

  return (
    <SQLContext.Provider
      value={{
        connections,
        activeConnectionId,
        connectionState,
        isConnected,
        schemas,
        selectedSchema,
        tables,
        views: viewsList,
        sequences,
        procedures,
        functions,
        packages,
        triggers: triggersList,
        columnMap,
        worksheets,
        activeWorksheetId,
        executing,
        lastResult,
        scriptResult,
        explainResult,
        queryHistory,
        savedQueries,
        messages,
        dbmsOutput,
        loading,
        saveConnection,
        deleteConnection,
        testConnection,
        setActiveConnection,
        disconnect,
        selectSchema,
        refreshSchema,
        loadSchemas,
        executeQuery,
        executeScript,
        cancelQuery,
        explainPlan,
        explainPlanForWorksheet,
        enableDbmsOutput,
        getDbmsOutput: getDbmsOutputFn,
        commit,
        rollback,
        getTableColumns,
        getTableConstraints,
        getTableIndexes,
        getTableTriggers,
        getObjectDDL,
        getTableRowCount,
        describeObject,
        loadHistory,
        clearHistory,
        loadSavedQueries,
        saveQuery,
        deleteSavedQuery,
        addWorksheet,
        removeWorksheet,
        setActiveWorksheet: setActiveWorksheetFn,
        updateWorksheetSql,
        renameWorksheet,
        addMessage,
        clearMessages,
        setEditorSqlAndExecute,
        setEditorSql,
        patchResultCell,
        isWorksheetExecuting,
      }}
    >
      {children}
    </SQLContext.Provider>
  )
}
