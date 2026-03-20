import { useState, useEffect, type FC } from 'react'
import { useDynamoDB } from '@/ui/contexts/dynamodb'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RefreshCw, ChevronLeft, ChevronRight, Database, Key, Hash, Plus, MoreHorizontal, Pencil, Eye, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { QueryBuilder } from '@/ui/components/dynamodb/QueryBuilder'
import { ItemEditor } from '@/ui/components/dynamodb/ItemEditor'
import { InlineCellEditor } from '@/ui/components/dynamodb/InlineCellEditor'

interface DynamoDBViewProps {
  tableName: string | null
}

interface EditingCell {
  rowIndex: number
  column: string
}

export const DynamoDBView: FC<DynamoDBViewProps> = ({ tableName }) => {
  const { getTableInfo, scanTable, queryTable, putItem, deleteItem } = useDynamoDB()
  const [tableInfo, setTableInfo] = useState<DynamoDBTableInfo | null>(null)
  const [scanResult, setScanResult] = useState<DynamoDBScanResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastEvaluatedKeys, setLastEvaluatedKeys] = useState<Array<Record<string, unknown>>>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [lastQueryOptions, setLastQueryOptions] = useState<DynamoDBQueryOptions | DynamoDBScanOptions | null>(null)
  const [queryMode, setQueryMode] = useState<'scan' | 'query'>('scan')

  // Item editor state
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorItem, setEditorItem] = useState<Record<string, unknown> | null>(null)
  const [editorMode, setEditorMode] = useState<'view' | 'edit' | 'create'>('view')

  // Inline editing state
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)

  const loadTableInfo = async () => {
    if (!tableName) return
    try {
      const info = await getTableInfo(tableName)
      setTableInfo(info)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load table info')
    }
  }

  const executeScan = async (options: DynamoDBScanOptions, isNewQuery = true) => {
    if (!tableName) return

    setLoading(true)
    setError(null)

    if (isNewQuery) {
      setLastEvaluatedKeys([])
      setCurrentPage(0)
      setLastQueryOptions(options)
      setQueryMode('scan')
    }

    try {
      const result = await scanTable(tableName, options)
      setScanResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan table')
    } finally {
      setLoading(false)
    }
  }

  const executeQuery = async (options: DynamoDBQueryOptions, isNewQuery = true) => {
    if (!tableName) return

    setLoading(true)
    setError(null)

    if (isNewQuery) {
      setLastEvaluatedKeys([])
      setCurrentPage(0)
      setLastQueryOptions(options)
      setQueryMode('query')
    }

    try {
      const result = await queryTable(tableName, options)
      setScanResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to query table')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tableName) {
      setLastEvaluatedKeys([])
      setCurrentPage(0)
      setScanResult(null)
      setLastQueryOptions(null)
      setEditingCell(null)
      loadTableInfo()
      executeScan({ limit: 50 })
    }
  }, [tableName])

  const handleNextPage = async () => {
    if (!scanResult?.lastEvaluatedKey || !lastQueryOptions) return

    setLastEvaluatedKeys((prev) => [...prev, scanResult.lastEvaluatedKey!])
    setCurrentPage((prev) => prev + 1)

    const optionsWithKey = {
      ...lastQueryOptions,
      exclusiveStartKey: scanResult.lastEvaluatedKey,
    }

    if (queryMode === 'query') {
      await executeQuery(optionsWithKey as DynamoDBQueryOptions, false)
    } else {
      await executeScan(optionsWithKey as DynamoDBScanOptions, false)
    }
  }

  const handlePrevPage = async () => {
    if (currentPage === 0 || !lastQueryOptions) return

    const newKeys = [...lastEvaluatedKeys]
    newKeys.pop()
    setLastEvaluatedKeys(newKeys)
    setCurrentPage((prev) => prev - 1)

    const startKey = newKeys.length > 0 ? newKeys[newKeys.length - 1] : undefined
    const optionsWithKey = {
      ...lastQueryOptions,
      exclusiveStartKey: startKey,
    }

    if (queryMode === 'query') {
      await executeQuery(optionsWithKey as DynamoDBQueryOptions, false)
    } else {
      await executeScan(optionsWithKey as DynamoDBScanOptions, false)
    }
  }

  const handleRefresh = () => {
    if (lastQueryOptions) {
      if (queryMode === 'query') {
        executeQuery({ ...lastQueryOptions, exclusiveStartKey: undefined } as DynamoDBQueryOptions)
      } else {
        executeScan({ ...lastQueryOptions, exclusiveStartKey: undefined } as DynamoDBScanOptions)
      }
    } else {
      executeScan({ limit: 50 })
    }
  }

  const openItemViewer = (item: Record<string, unknown>) => {
    setEditorItem(item)
    setEditorMode('view')
    setEditorOpen(true)
  }

  const openItemEditor = (item: Record<string, unknown>) => {
    setEditorItem(item)
    setEditorMode('edit')
    setEditorOpen(true)
  }

  const openCreateItem = () => {
    setEditorItem(null)
    setEditorMode('create')
    setEditorOpen(true)
  }

  const handleSaveItem = async (item: Record<string, unknown>) => {
    if (!tableName) return
    await putItem(tableName, item)
    handleRefresh()
  }

  const handleDeleteItem = async (key: Record<string, unknown>) => {
    if (!tableName) return
    await deleteItem(tableName, key)
    handleRefresh()
  }

  const getItemKey = (item: Record<string, unknown>): Record<string, unknown> => {
    const key: Record<string, unknown> = {}
    tableInfo?.keySchema.forEach(k => {
      key[k.attributeName] = item[k.attributeName]
    })
    return key
  }

  const handleInlineSave = async (item: Record<string, unknown>, column: string, newValue: unknown) => {
    if (!tableName) return

    const updatedItem = { ...item, [column]: newValue }
    // Remove undefined values
    if (newValue === undefined) {
      delete updatedItem[column]
    }
    await putItem(tableName, updatedItem)
    setEditingCell(null)
    handleRefresh()
  }

  const isKeyAttribute = (column: string) => {
    return tableInfo?.keySchema.some(k => k.attributeName === column) || false
  }

  if (!tableName) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Database className="h-12 w-12 mb-4" />
        <p>Select a table to view its contents</p>
      </div>
    )
  }

  const columns = scanResult?.items && scanResult.items.length > 0
    ? Array.from(new Set(scanResult.items.flatMap((item) => Object.keys(item))))
    : []

  const partitionKey = tableInfo?.keySchema.find((k) => k.keyType === 'HASH')?.attributeName
  const sortKey = tableInfo?.keySchema.find((k) => k.keyType === 'RANGE')?.attributeName

  // Sort columns to put keys first
  const sortedColumns = [...columns].sort((a, b) => {
    if (a === partitionKey) return -1
    if (b === partitionKey) return 1
    if (a === sortKey) return -1
    if (b === sortKey) return 1
    return a.localeCompare(b)
  })

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header - fixed */}
      <div className="flex-shrink-0 flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Database className="h-5 w-5" />
            {tableName}
          </h2>
          {tableInfo && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
              <span>{tableInfo.itemCount.toLocaleString()} items</span>
              <span>{formatBytes(tableInfo.tableSizeBytes)}</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded",
                tableInfo.tableStatus === 'ACTIVE' ? 'bg-status-green-bg text-status-green' : 'bg-status-yellow-bg text-status-yellow'
              )}>
                {tableInfo.tableStatus}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={openCreateItem}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Item
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Schema - fixed */}
      {tableInfo && (
        <div className="flex-shrink-0 flex items-center gap-4 px-4 py-2 bg-muted/50 text-xs border-b">
          {partitionKey && (
            <span className="flex items-center gap-1">
              <Key className="h-3 w-3" />
              Partition: <code className="bg-background px-1 rounded">{partitionKey}</code>
            </span>
          )}
          {sortKey && (
            <span className="flex items-center gap-1">
              <Hash className="h-3 w-3" />
              Sort: <code className="bg-background px-1 rounded">{sortKey}</code>
            </span>
          )}
          {tableInfo.globalSecondaryIndexes && tableInfo.globalSecondaryIndexes.length > 0 && (
            <span className="truncate">GSIs: {tableInfo.globalSecondaryIndexes.map((g) => g.indexName).join(', ')}</span>
          )}
        </div>
      )}

      {/* Query Builder - fixed */}
      <div className="flex-shrink-0">
        <QueryBuilder
          tableInfo={tableInfo}
          onQuery={executeQuery}
          onScan={executeScan}
          loading={loading}
        />
      </div>

      {/* Error - fixed */}
      {error && (
        <div className="flex-shrink-0 p-4 bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !scanResult && (
        <div className="flex items-center justify-center flex-1 text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Loading...
        </div>
      )}

      {/* Data Table - scrollable with isolated stacking context */}
      {scanResult && sortedColumns.length > 0 && (
        <div className="flex-1 min-h-0 overflow-auto relative isolate">
          <table className="w-full text-sm">
            <thead className="bg-muted sticky top-0 z-[1]">
              <tr>
                <th className="px-2 py-2 text-left font-medium whitespace-nowrap border-b w-10">
                  {/* Actions column */}
                </th>
                {sortedColumns.map((col) => (
                  <th
                    key={col}
                    className={cn(
                      "px-3 py-2 text-left font-medium whitespace-nowrap border-b",
                      col === partitionKey && "bg-primary/10",
                      col === sortKey && "bg-secondary/10"
                    )}
                  >
                    <span className="flex items-center gap-1">
                      {col === partitionKey && <Key className="h-3 w-3" />}
                      {col === sortKey && <Hash className="h-3 w-3" />}
                      {col}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scanResult.items.map((item, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-b hover:bg-muted/50 group"
                >
                  <td className="px-2 py-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => openItemViewer(item)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openItemEditor(item)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDeleteItem(getItemKey(item))}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                  {sortedColumns.map((col) => {
                    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.column === col
                    const isKey = isKeyAttribute(col)

                    return (
                      <td
                        key={col}
                        className={cn(
                          "px-3 py-2 whitespace-nowrap max-w-[300px]",
                          !isEditing && "truncate cursor-pointer hover:bg-muted/50",
                          isKey && "bg-muted/30"
                        )}
                        title={!isEditing ? formatValue(item[col]) : undefined}
                        onDoubleClick={() => setEditingCell({ rowIndex, column: col })}
                      >
                        {isEditing ? (
                          <InlineCellEditor
                            value={item[col]}
                            attributeName={col}
                            isKey={isKey}
                            onSave={(newValue) => handleInlineSave(item, col, newValue)}
                            onCancel={() => setEditingCell(null)}
                          />
                        ) : (
                          formatValue(item[col])
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {scanResult && scanResult.items.length === 0 && (
        <div className="flex items-center justify-center flex-1 text-muted-foreground">
          No items found
        </div>
      )}

      {/* Pagination - fixed */}
      {scanResult && (
        <div className="flex-shrink-0 flex items-center justify-between p-3 border-t bg-muted/50">
          <span className="text-xs text-muted-foreground">
            Showing {scanResult.count} items (page {currentPage + 1})
            {scanResult.scannedCount !== scanResult.count && ` • Scanned: ${scanResult.scannedCount}`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={currentPage === 0 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={!scanResult.lastEvaluatedKey || loading}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Item Editor Sheet */}
      <ItemEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        item={editorItem}
        tableInfo={tableInfo}
        mode={editorMode}
        onSave={handleSaveItem}
        onDelete={handleDeleteItem}
      />
    </div>
  )
}

function formatValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
