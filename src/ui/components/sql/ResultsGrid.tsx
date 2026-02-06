import { useState, useMemo, useCallback, useRef, useEffect, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowUpDown, ArrowUp, ArrowDown, Copy, Download } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ResultsGridProps {
  result: SQLQueryResult | null
  className?: string
  editable?: boolean
  onCellEdit?: (rowIdx: number, colIdx: number, newValue: string | null) => Promise<void>
}

type SortDirection = 'asc' | 'desc' | null

const MIN_COL_WIDTH = 60

export const ResultsGrid: FC<ResultsGridProps> = ({ result, className, editable, onCellEdit }) => {
  const [sortCol, setSortCol] = useState<number | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null)
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [colWidths, setColWidths] = useState<Record<number, number>>({})
  const resizingRef = useRef<{ colIdx: number; startX: number; startWidth: number } | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const originalEditValue = useRef('')

  const sortedRows = useMemo(() => {
    if (!result?.rows) return []
    if (sortCol === null || sortDir === null) return result.rows

    return [...result.rows].sort((a, b) => {
      const aVal = a[sortCol]
      const bVal = b[sortCol]
      if (aVal === null && bVal === null) return 0
      if (aVal === null) return sortDir === 'asc' ? -1 : 1
      if (bVal === null) return sortDir === 'asc' ? 1 : -1
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }
      const aStr = String(aVal)
      const bStr = String(bVal)
      return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
    })
  }, [result?.rows, sortCol, sortDir])

  const handleSort = (colIndex: number) => {
    if (sortCol === colIndex) {
      if (sortDir === 'asc') setSortDir('desc')
      else if (sortDir === 'desc') { setSortCol(null); setSortDir(null) }
    } else {
      setSortCol(colIndex)
      setSortDir('asc')
    }
  }

  const handleCopyCell = (value: unknown) => {
    const text = value === null ? 'NULL' : String(value)
    navigator.clipboard.writeText(text)
  }

  const handleExportCSV = () => {
    if (!result) return
    const header = result.columns.map((c) => c.name).join(',')
    const rows = result.rows.map((row) =>
      row.map((cell) => {
        if (cell === null) return ''
        const str = String(cell)
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str
      }).join(',')
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'query_results.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleResizeStart = useCallback((e: React.MouseEvent, colIdx: number) => {
    e.preventDefault()
    e.stopPropagation()
    const th = (e.target as HTMLElement).closest('th')
    const startWidth = th?.getBoundingClientRect().width ?? 150
    resizingRef.current = { colIdx, startX: e.clientX, startWidth }

    const handleMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return
      const { colIdx: resizeCol, startX, startWidth } = resizingRef.current
      const delta = ev.clientX - startX
      const newWidth = Math.max(MIN_COL_WIDTH, startWidth + delta)
      setColWidths((prev) => ({ ...prev, [resizeCol]: newWidth }))
    }

    const handleMouseUp = () => {
      resizingRef.current = null
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  const handleResizeDoubleClick = useCallback((colIdx: number) => {
    // Auto-fit: reset to auto width
    setColWidths((prev) => {
      const next = { ...prev }
      delete next[colIdx]
      return next
    })
  }, [])

  const handleStartEdit = useCallback((rowIdx: number, colIdx: number, cell: unknown) => {
    if (!editable || !onCellEdit) return
    const val = cell === null || cell === undefined ? '' : String(cell)
    setEditingCell({ row: rowIdx, col: colIdx })
    setEditValue(val)
    originalEditValue.current = val
  }, [editable, onCellEdit])

  const handleSaveEdit = useCallback(async () => {
    if (!editingCell || !onCellEdit || saving) return
    // If value unchanged, just cancel - don't fire UPDATE
    if (editValue === originalEditValue.current) {
      setEditingCell(null)
      return
    }
    setSaving(true)
    try {
      const newVal = editValue.trim() === '' ? null : editValue
      await onCellEdit(editingCell.row, editingCell.col, newVal)
      setEditingCell(null)
    } catch {
      // Error handled by caller via toast
    } finally {
      setSaving(false)
    }
  }, [editingCell, editValue, onCellEdit, saving])

  const handleCancelEdit = useCallback(() => {
    setEditingCell(null)
    setEditValue('')
  }, [])

  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingCell])

  if (!result || !result.columns.length) {
    return (
      <div className={cn('flex items-center justify-center h-full text-muted-foreground text-sm', className)}>
        No results to display
      </div>
    )
  }

  const hasFixedWidths = Object.keys(colWidths).length > 0

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Grid - native scroll for both axes */}
      <div className="flex-1 overflow-auto min-h-0">
        <table
          className={cn('border-collapse text-xs font-mono', hasFixedWidths ? 'table-fixed' : 'w-full')}
          style={hasFixedWidths ? { width: 'max-content', minWidth: '100%' } : undefined}
        >
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#1e1f23]">
              <th className="w-10 min-w-[40px] px-2 py-1.5 text-right text-muted-foreground font-normal border-b border-r border-border">
                #
              </th>
              {result.columns.map((col, i) => (
                <th
                  key={i}
                  className="relative px-3 py-1.5 text-left font-medium border-b border-r border-border cursor-pointer hover:bg-[#252629] select-none whitespace-nowrap group"
                  style={colWidths[i] ? { width: colWidths[i], minWidth: MIN_COL_WIDTH } : { minWidth: MIN_COL_WIDTH }}
                  onClick={() => handleSort(i)}
                >
                  <div className="flex items-center gap-1">
                    <span>{col.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {col.type}
                    </span>
                    {sortCol === i ? (
                      sortDir === 'asc' ? (
                        <ArrowUp className="h-3 w-3 text-[#c74634]" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-[#c74634]" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    )}
                  </div>
                  {/* Resize handle */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#c74634]/50 active:bg-[#c74634]"
                    onMouseDown={(e) => handleResizeStart(e, i)}
                    onDoubleClick={(e) => { e.stopPropagation(); handleResizeDoubleClick(i) }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className={cn(
                  'hover:bg-[#1e1f23] transition-colors',
                  rowIdx % 2 === 1 && 'bg-[#1a1b1e]/50'
                )}
              >
                <td className="px-2 py-1 text-right text-muted-foreground border-r border-border">
                  {rowIdx + 1}
                </td>
                {row.map((cell, colIdx) => {
                  const isSelected = selectedCell?.row === rowIdx && selectedCell?.col === colIdx
                  const isEditing = editingCell?.row === rowIdx && editingCell?.col === colIdx
                  const isNull = cell === null || cell === undefined
                  return (
                    <td
                      key={colIdx}
                      className={cn(
                        'px-3 py-1 border-r border-border',
                        !isEditing && 'truncate',
                        isSelected && !isEditing && 'bg-[#264f78] ring-1 ring-[#56d4dd]',
                        isNull && !isEditing && 'italic text-muted-foreground'
                      )}
                      style={colWidths[colIdx] ? { maxWidth: colWidths[colIdx] } : { maxWidth: 300 }}
                      onClick={() => setSelectedCell({ row: rowIdx, col: colIdx })}
                      onDoubleClick={() => {
                        if (editable && onCellEdit) {
                          handleStartEdit(rowIdx, colIdx, cell)
                        } else {
                          handleCopyCell(cell)
                        }
                      }}
                      title={isNull ? 'NULL' : String(cell)}
                    >
                      {isEditing ? (
                        <input
                          ref={editInputRef}
                          className="w-full bg-[#1e1f23] border border-[#56d4dd] rounded px-1 py-0 text-xs font-mono outline-none"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit()
                            if (e.key === 'Escape') handleCancelEdit()
                          }}
                          onBlur={handleSaveEdit}
                          disabled={saving}
                        />
                      ) : (
                        isNull ? 'NULL' : String(cell)
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-border bg-[#1e1f23] text-xs text-muted-foreground flex-shrink-0">
        <div className="flex items-center gap-3">
          <span>
            {result.rowCount} row{result.rowCount !== 1 ? 's' : ''} fetched
            {result.executionTime ? ` in ${result.executionTime}ms` : ''}
          </span>
          {result.affectedRows !== undefined && result.affectedRows > 0 && (
            <span>{result.affectedRows} row{result.affectedRows !== 1 ? 's' : ''} affected</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {selectedCell && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[10px]"
              onClick={() => {
                const cell = result.rows[selectedCell.row]?.[selectedCell.col]
                handleCopyCell(cell)
              }}
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[10px]"
            onClick={handleExportCSV}
          >
            <Download className="h-3 w-3 mr-1" />
            CSV
          </Button>
        </div>
      </div>
    </div>
  )
}
