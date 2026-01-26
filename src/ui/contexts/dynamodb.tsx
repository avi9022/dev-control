import { createContext, useContext, useState, useEffect, type FC, type PropsWithChildren } from 'react'
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
})

export function useDynamoDB() {
  return useContext(DynamoDBContext)
}

export const DynamoDBProvider: FC<PropsWithChildren> = ({ children }) => {
  const [tables, setTables] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const { updateView } = useViews()

  const refreshTables = async () => {
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
  }

  const selectTable = (tableName: string | null) => {
    setSelectedTable(tableName)
    updateView('dynamodb', tableName)
  }

  const getTableInfo = async (tableName: string) => {
    return await window.electron.dynamodbDescribeTable(tableName)
  }

  const scanTable = async (tableName: string, options?: DynamoDBScanOptions) => {
    return await window.electron.dynamodbScanTable(tableName, options)
  }

  const queryTable = async (tableName: string, options: DynamoDBQueryOptions) => {
    return await window.electron.dynamodbQueryTable(tableName, options)
  }

  const getItem = async (tableName: string, key: Record<string, unknown>) => {
    return await window.electron.dynamodbGetItem(tableName, key)
  }

  const putItem = async (tableName: string, item: Record<string, unknown>) => {
    return await window.electron.dynamodbPutItem(tableName, item)
  }

  const deleteItem = async (tableName: string, key: Record<string, unknown>) => {
    return await window.electron.dynamodbDeleteItem(tableName, key)
  }

  // Load tables on mount
  useEffect(() => {
    refreshTables()
  }, [])

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
      }}
    >
      {children}
    </DynamoDBContext.Provider>
  )
}
