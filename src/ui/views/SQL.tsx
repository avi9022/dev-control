import { useState, useCallback, useEffect, useMemo, useRef, type FC } from 'react'
import { useSQL } from '../contexts/sql'
import { toast } from 'sonner'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { SQLToolbar } from '../components/sql/SQLToolbar'
import { WorksheetTabs } from '../components/sql/WorksheetTabs'
import { SQLEditor, type SQLEditorHandle } from '../components/sql/SQLEditor'
import { ResultsPanel } from '../components/sql/ResultsPanel'
import { QueryHistory } from '../components/sql/QueryHistory'
import { TableDetailView } from './TableDetail'

interface SQLViewProps {
  itemId: string | null
}

export const SQLView: FC<SQLViewProps> = ({ itemId }) => {
  // Check if we should show a table detail view
  if (itemId?.startsWith('table:')) {
    const parts = itemId.slice(6) // Remove "table:" prefix
    const dotIdx = parts.indexOf('.')
    if (dotIdx > 0) {
      const schema = parts.slice(0, dotIdx)
      const table = parts.slice(dotIdx + 1)
      return <TableDetailView schema={schema} table={table} />
    }
  }

  return <SQLEditorView />
}

const SQLEditorView: FC = () => {
  const {
    isConnected,
    schemas,
    selectedSchema,
    tables,
    selectSchema,
    worksheets,
    activeWorksheetId,
    addWorksheet,
    removeWorksheet,
    removeOtherWorksheets,
    removeAllWorksheets,
    setActiveWorksheet,
    updateWorksheetSql,
    renameWorksheet,
    columnMap,
    executeQuery,
    executeScript,
    cancelQuery,
    explainPlanForWorksheet,
    commit,
    rollback,
    executing,
    lastResult,
    explainResult,
    messages,
    dbmsOutput,
    queryHistory,
    loadHistory,
    clearHistory,
    saveQuery,
    clearMessages,
    patchResultCell,
    isWorksheetExecuting,
  } = useSQL()

  const editorRef = useRef<SQLEditorHandle>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  // Dirty state: SQL differs from last executed SQL
  const isWorksheetDirty = useCallback((id: string) => {
    const ws = worksheets.find((w) => w.id === id)
    if (!ws) return false
    return ws.sql !== (ws.lastExecutedSql ?? '')
  }, [worksheets])

  // Detect if last result is editable (simple single-table SELECT)
  const editableTable = useMemo<{ schema: string; table: string } | null>(() => {
    if (!lastResult?.statement || lastResult.type !== 'SELECT') return null
    // Skip if query has JOINs or subqueries
    if (/\bJOIN\b/i.test(lastResult.statement)) return null
    if (/\(\s*SELECT\b/i.test(lastResult.statement)) return null

    // Match FROM "SCHEMA"."TABLE" or FROM SCHEMA.TABLE or FROM "TABLE" or FROM TABLE
    const match = lastResult.statement.match(
      /\bFROM\s+(?:"([^"]+)"\."([^"]+)"|(\w+)\.(\w+)|"([^"]+)"|(\w+))/i
    )
    if (!match) return null

    const schema = match[1] ?? match[3] ?? selectedSchema
    const table = match[2] ?? match[4] ?? match[5] ?? match[6]
    if (!schema || !table) return null

    return { schema: schema.toUpperCase(), table: table.toUpperCase() }
  }, [lastResult, selectedSchema])

  const activeWorksheet = worksheets.find((w) => w.id === activeWorksheetId)
  const currentSql = activeWorksheet?.sql ?? ''
  const tableNames = tables.map((t) => t.name)

  const handleSqlChange = useCallback((sql: string) => {
    if (activeWorksheetId) {
      updateWorksheetSql(activeWorksheetId, sql)
    }
  }, [activeWorksheetId, updateWorksheetSql])

  const handleExecute = useCallback(async (sql?: string) => {
    const statement = sql || editorRef.current?.getCurrentStatement() || currentSql.trim()
    if (!statement) return
    try {
      await executeQuery(statement)
      loadHistory()
    } catch {
      // Error handled by context
    }
  }, [currentSql, executeQuery, loadHistory])

  const handleExecuteScript = useCallback(async (sql?: string) => {
    const script = sql ?? currentSql.trim()
    if (!script) return
    try {
      await executeScript(script)
      loadHistory()
    } catch {
      // Error handled by context
    }
  }, [currentSql, executeScript, loadHistory])

  const handleExplain = useCallback(async () => {
    if (!currentSql.trim()) return
    try {
      await explainPlanForWorksheet(currentSql.trim())
    } catch {
      // Error handled by context
    }
  }, [currentSql, explainPlanForWorksheet])

  const handleStop = useCallback(async () => {
    if (lastResult?.queryId) {
      await cancelQuery(lastResult.queryId)
    }
  }, [lastResult, cancelQuery])

  const handleFormat = useCallback(() => {
    // Basic formatting: uppercase keywords, normalize whitespace
    if (!activeWorksheetId) return
    const formatted = currentSql
      .replace(/\b(SELECT|FROM|WHERE|AND|OR|JOIN|LEFT|RIGHT|INNER|OUTER|ON|ORDER|BY|GROUP|HAVING|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|ALTER|DROP|TABLE|INDEX|VIEW|AS|IN|NOT|NULL|IS|BETWEEN|LIKE|DISTINCT|UNION|ALL|EXISTS|CASE|WHEN|THEN|ELSE|END|BEGIN|DECLARE|CURSOR|OPEN|FETCH|CLOSE|COMMIT|ROLLBACK|GRANT|REVOKE)\b/gi, (m) => m.toUpperCase())
    updateWorksheetSql(activeWorksheetId, formatted)
  }, [currentSql, activeWorksheetId, updateWorksheetSql])

  const handleHistorySelect = useCallback((sql: string) => {
    if (activeWorksheetId) {
      updateWorksheetSql(activeWorksheetId, sql)
    }
  }, [activeWorksheetId, updateWorksheetSql])

  const handleCellEdit = useCallback(async (rowIdx: number, colIdx: number, newValue: string | null) => {
    if (!lastResult || !editableTable) return

    const colName = lastResult.columns[colIdx]?.name
    if (!colName) return

    const qualifiedName = `"${editableTable.schema}"."${editableTable.table}"`
    const valueStr = newValue === null ? 'NULL' : `'${newValue.replace(/'/g, "''")}'`

    // Build WHERE clause using column values to identify the row
    // Skip DATE/TIMESTAMP/LOB columns - they cause ORA-01861 format mismatch
    const skipTypes = /DATE|TIMESTAMP|CLOB|BLOB|LOB|LONG|RAW|XMLTYPE|BFILE/i
    const whereParts = lastResult.columns
      .map((col, i) => {
        if (skipTypes.test(col.type)) return null
        const val = lastResult.rows[rowIdx]?.[i]
        if (val === null || val === undefined) return `"${col.name}" IS NULL`
        return `"${col.name}" = '${String(val).replace(/'/g, "''")}'`
      })
      .filter((part): part is string => part !== null)

    const updateSql = `UPDATE ${qualifiedName} SET "${colName}" = ${valueStr} WHERE ${whereParts.join(' AND ')} AND ROWNUM = 1`

    try {
      // Use IPC directly to avoid overwriting lastResult
      await window.electron.sqlExecuteQuery(updateSql)
      await window.electron.sqlExecuteQuery('COMMIT')
      // Patch the cell in-place - no re-query needed
      patchResultCell(rowIdx, colIdx, newValue)
      toast.success('Updated', { description: `${colName} updated` })
    } catch (err) {
      toast.error('Update failed', { description: err instanceof Error ? err.message : 'Operation failed' })
      throw err
    }
  }, [lastResult, editableTable, patchResultCell])

  // Keyboard shortcuts: Cmd+T (new sheet), Cmd+W (close active sheet)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 't') {
        e.preventDefault()
        addWorksheet()
      }
      if (mod && e.key === 'w') {
        e.preventDefault()
        if (activeWorksheetId) {
          removeWorksheet(activeWorksheetId)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [addWorksheet, removeWorksheet, activeWorksheetId])

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground bg-[#1a1b1e]">
        <div className="text-center">
          <p className="text-lg font-medium">Not connected</p>
          <p className="text-sm mt-1">Connect to an Oracle Database to start querying</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[#1a1b1e]">
      {/* Toolbar */}
      <SQLToolbar
        schemas={schemas}
        selectedSchema={selectedSchema}
        onSchemaChange={selectSchema}
        onExecute={() => handleExecute()}
        onExecuteScript={() => handleExecuteScript()}
        onExplainPlan={handleExplain}
        onStop={handleStop}
        onCommit={commit}
        onRollback={rollback}
        onFormat={handleFormat}
        onHistory={() => setHistoryOpen(true)}
        executing={executing}
        isConnected={isConnected}
      />

      {/* Worksheet tabs */}
      <WorksheetTabs
        worksheets={worksheets}
        activeId={activeWorksheetId}
        onSelect={setActiveWorksheet}
        onAdd={addWorksheet}
        onClose={removeWorksheet}
        onCloseOthers={removeOtherWorksheets}
        onCloseAll={removeAllWorksheets}
        onRename={renameWorksheet}
        isDirty={isWorksheetDirty}
        isExecuting={isWorksheetExecuting}
      />

      {/* Editor + Results split */}
      <ResizablePanelGroup direction="vertical" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={50} minSize={20}>
          <SQLEditor
            ref={editorRef}
            value={currentSql}
            onChange={handleSqlChange}
            onExecute={handleExecute}
            onExecuteScript={handleExecuteScript}
            tables={tableNames}
            columnMap={columnMap}
            selectedSchema={selectedSchema}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={50} minSize={15}>
          <ResultsPanel
            result={lastResult}
            executing={executing}
            explainPlan={explainResult}
            dbmsOutput={dbmsOutput}
            messages={messages}
            onClearDbmsOutput={() => {}}
            onClearMessages={clearMessages}
            editable={!!editableTable}
            onCellEdit={handleCellEdit}
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* History drawer */}
      <QueryHistory
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        history={queryHistory}
        onClear={clearHistory}
        onSelect={handleHistorySelect}
        onSave={(entry) => saveQuery({
          id: crypto.randomUUID(),
          connectionId: entry.connectionId,
          name: entry.sql.slice(0, 50),
          sql: entry.sql,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })}
      />
    </div>
  )
}
