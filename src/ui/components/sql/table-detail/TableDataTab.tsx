import { useState, useCallback, useEffect, useMemo, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { Play, ChevronLeft, ChevronRight } from 'lucide-react'
import { ResultsGrid } from '../ResultsGrid'
import { ColumnAutocompleteInput } from '../ColumnAutocompleteInput'
import { toast } from 'sonner'

interface TableDataTabProps {
  schema: string
  table: string
  columns?: string[]
}

const PAGE_SIZE = 50

export const TableDataTab: FC<TableDataTabProps> = ({ schema, table, columns: columnNames = [] }) => {
  const [rawResult, setRawResult] = useState<SQLQueryResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [whereClause, setWhereClause] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  const qualifiedName = `"${schema}"."${table}"`

  const fetchPage = useCallback(async (pageNum: number, where?: string) => {
    setLoading(true)
    try {
      const offset = pageNum * PAGE_SIZE
      const whereStr = where?.trim() ? ` WHERE ${where.trim()}` : ''
      // Include ROWID for unique row identification during edits
      const sql = `SELECT * FROM (SELECT a.*, ROWID AS rid__, ROWNUM rn__ FROM (SELECT * FROM ${qualifiedName}${whereStr}) a WHERE ROWNUM <= ${offset + PAGE_SIZE}) WHERE rn__ > ${offset}`
      const res = await window.electron.sqlExecuteQuery(sql)
      setRawResult(res)
      setPage(pageNum)
      setHasMore(res.rowCount >= PAGE_SIZE)
    } catch (err) {
      setRawResult({
        queryId: '',
        columns: [],
        rows: [],
        rowCount: 0,
        executionTime: 0,
        statement: '',
        type: 'SELECT',
        warnings: [err instanceof Error ? err.message : 'Query failed'],
      })
    } finally {
      setLoading(false)
    }
  }, [qualifiedName])

  useEffect(() => {
    fetchPage(0)
  }, [fetchPage])

  // Filter out the internal RID__ and RN__ columns from display
  const displayResult = useMemo<SQLQueryResult | null>(() => {
    if (!rawResult) return null
    const hiddenCols = new Set(['RID__', 'RN__'])
    const visibleIndices = rawResult.columns
      .map((col, i) => ({ col, i }))
      .filter(({ col }) => !hiddenCols.has(col.name.toUpperCase()))
    return {
      ...rawResult,
      columns: visibleIndices.map(({ col }) => col),
      rows: rawResult.rows.map((row) => visibleIndices.map(({ i }) => row[i])),
    }
  }, [rawResult])

  // Find ROWID column index in raw result
  const rowidColIdx = useMemo(() => {
    if (!rawResult) return -1
    return rawResult.columns.findIndex((c) => c.name.toUpperCase() === 'RID__')
  }, [rawResult])

  const handleCellEdit = useCallback(async (rowIdx: number, colIdx: number, newValue: string | null) => {
    if (!rawResult || !displayResult || rowidColIdx < 0) return

    const rowid = rawResult.rows[rowIdx]?.[rowidColIdx]
    if (!rowid) {
      toast.error('Cannot identify row', { description: 'ROWID not found' })
      return
    }

    const colName = displayResult.columns[colIdx]?.name
    if (!colName) return

    const valueStr = newValue === null ? 'NULL' : `'${newValue.replace(/'/g, "''")}'`
    const updateSql = `UPDATE ${qualifiedName} SET "${colName}" = ${valueStr} WHERE ROWID = '${rowid}'`

    try {
      await window.electron.sqlExecuteQuery(updateSql)
      await window.electron.sqlExecuteQuery('COMMIT')
      toast.success('Updated', { description: `${colName} updated` })
      // Patch the cell in-place - no re-query needed
      setRawResult((prev) => {
        if (!prev) return prev
        // Find the raw column index for this display column
        const rawColIdx = prev.columns.findIndex((c) => c.name.toUpperCase() === colName.toUpperCase())
        if (rawColIdx < 0) return prev
        return {
          ...prev,
          rows: prev.rows.map((row, i) =>
            i === rowIdx ? row.map((cell, j) => (j === rawColIdx ? newValue : cell)) : row
          ),
        }
      })
    } catch (err) {
      toast.error('Update failed', { description: err instanceof Error ? err.message : 'Operation failed' })
      throw err
    }
  }, [rawResult, displayResult, rowidColIdx, qualifiedName])

  const handleExecute = useCallback(() => {
    fetchPage(0, whereClause)
  }, [fetchPage, whereClause])

  const handlePrev = useCallback(() => {
    if (page > 0) fetchPage(page - 1, whereClause)
  }, [page, fetchPage, whereClause])

  const handleNext = useCallback(() => {
    if (hasMore) fetchPage(page + 1, whereClause)
  }, [hasMore, page, fetchPage, whereClause])

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <span className="text-xs text-muted-foreground whitespace-nowrap">WHERE</span>
        <ColumnAutocompleteInput
          placeholder="e.g. status = 'ACTIVE'"
          className="h-7 text-xs flex-1"
          value={whereClause}
          onChange={setWhereClause}
          onSubmit={handleExecute}
          columns={columnNames}
        />
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2"
          onClick={handleExecute}
          disabled={loading}
        >
          <Play className="h-3 w-3 mr-1" />
          {loading ? 'Loading...' : 'Run'}
        </Button>
      </div>

      {/* Results */}
      <div className="flex-1 min-h-0">
        {!displayResult ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Loading...
          </div>
        ) : (
          <ResultsGrid
            result={displayResult}
            editable
            onCellEdit={handleCellEdit}
          />
        )}
      </div>

      {/* Pagination */}
      {displayResult && displayResult.rowCount > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-border text-xs text-muted-foreground">
          <span>
            Rows {page * PAGE_SIZE + 1} - {page * PAGE_SIZE + displayResult.rowCount}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handlePrev}
              disabled={page === 0 || loading}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span>Page {page + 1}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleNext}
              disabled={!hasMore || loading}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
