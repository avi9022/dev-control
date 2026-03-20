import { useState, useEffect, useRef, useCallback, type FC } from 'react'
import { KeyRound, Search, Plus, Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  ORACLE_TYPE_GROUPS, TYPES_REQUIRING_SIZE, isTypeCategoryChange, formatSize,
  buildRenameColumnSQL, buildModifyTypeSQL, buildModifyNullableSQL,
  buildModifyDefaultSQL, buildCommentSQL, buildAddColumnSQL, buildDropColumnSQL,
  validateColumnName,
} from './column-helpers'

interface TableColumnsTabProps {
  schema: string
  table: string
}

interface EditingCell {
  row: number
  field: 'name' | 'size' | 'default' | 'comment'
}

interface TypeChangeDialog {
  colName: string
  oldType: string
  newType: string
}

interface NewColumnState {
  name: string
  type: string
  size: string
  notNull: boolean
  defaultValue: string
}

const INITIAL_NEW_COL: NewColumnState = { name: '', type: '', size: '', notNull: false, defaultValue: '' }

function collectUnknownTypes(columns: SQLColumnDetail[]): string[] {
  const known = new Set(Object.values(ORACLE_TYPE_GROUPS).flat())
  const unknown = new Set<string>()
  for (const col of columns) {
    if (!known.has(col.type)) unknown.add(col.type)
  }
  return [...unknown].sort()
}

function TypeSelectDropdown({ value, onValueChange, unknownTypes, onOpenChange }: {
  value: string
  onValueChange: (v: string) => void
  unknownTypes: string[]
  onOpenChange?: (open: boolean) => void
}) {
  return (
    <Select defaultOpen value={value} onValueChange={onValueChange} onOpenChange={(open) => { if (!open) onOpenChange?.(false) }}>
      <SelectTrigger className="h-5 border-0 shadow-none px-1 py-0 text-xs font-mono bg-transparent min-w-0 w-auto gap-1 [&_svg]:hidden">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {unknownTypes.length > 0 && (
          <SelectGroup>
            <SelectLabel>Current</SelectLabel>
            {unknownTypes.map((t) => (
              <SelectItem key={t} value={t} className="text-xs font-mono">{t}</SelectItem>
            ))}
          </SelectGroup>
        )}
        {Object.entries(ORACLE_TYPE_GROUPS).map(([group, types]) => (
          <SelectGroup key={group}>
            <SelectLabel>{group}</SelectLabel>
            {types.map((t) => (
              <SelectItem key={t} value={t} className="text-xs font-mono">{t}</SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}

export const TableColumnsTab: FC<TableColumnsTabProps> = ({ schema, table }) => {
  const [columns, setColumns] = useState<SQLColumnDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [savingLabel, setSavingLabel] = useState<string | null>(null)
  const [editing, setEditing] = useState<EditingCell | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editingTypeRow, setEditingTypeRow] = useState<number | null>(null)
  const [typeChangeDialog, setTypeChangeDialog] = useState<TypeChangeDialog | null>(null)
  const [typeChangeSize, setTypeChangeSize] = useState('')
  const [deleteColumn, setDeleteColumn] = useState<string | null>(null)
  const [newCol, setNewCol] = useState<NewColumnState>(INITIAL_NEW_COL)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const loadColumns = useCallback(() => {
    setLoading(true)
    setError(null)
    window.electron.sqlGetTableColumns(schema, table)
      .then(setColumns)
      .catch((err) => {
        setColumns([])
        setError(err instanceof Error ? err.message : 'Failed to load columns')
      })
      .finally(() => setLoading(false))
  }, [schema, table])

  useEffect(() => { loadColumns() }, [loadColumns])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const executeAndRefresh = async (sql: string, successMsg: string, label?: string) => {
    if (savingLabel) return
    setSavingLabel(label ?? 'Executing...')
    try {
      await window.electron.sqlExecuteQuery(sql)
      toast.success(successMsg)
      setSavingLabel('Refreshing...')
      loadColumns()
    } catch (err) {
      toast.error('Operation failed', { description: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      setSavingLabel(null)
    }
  }

  const startEdit = (rowIndex: number, field: EditingCell['field'], currentValue: string) => {
    setEditing({ row: rowIndex, field })
    setEditValue(currentValue)
  }

  const commitEdit = async () => {
    if (!editing) return
    const col = filtered[editing.row]
    if (!col) return
    const trimmed = editValue.trim()

    setEditing(null)

    if (editing.field === 'name') {
      if (!trimmed || trimmed === col.name) return
      const nameError = validateColumnName(trimmed)
      if (nameError) { toast.error('Invalid name', { description: nameError }); return }
      await executeAndRefresh(
        buildRenameColumnSQL(schema, table, col.name, trimmed),
        `Renamed ${col.name} to ${trimmed}`,
        `Renaming ${col.name}...`
      )
    } else if (editing.field === 'size') {
      if (trimmed === formatSize(col)) return
      await executeAndRefresh(
        buildModifyTypeSQL(schema, table, col.name, col.type, trimmed || undefined),
        `Updated ${col.name} size`,
        `Modifying ${col.name}...`
      )
    } else if (editing.field === 'default') {
      if (trimmed === (col.defaultValue ?? '')) return
      await executeAndRefresh(
        buildModifyDefaultSQL(schema, table, col.name, trimmed),
        `Updated ${col.name} default`,
        `Updating default...`
      )
    } else if (editing.field === 'comment') {
      if (trimmed === (col.comments ?? '')) return
      await executeAndRefresh(
        buildCommentSQL(schema, table, col.name, trimmed),
        `Updated ${col.name} comment`,
        `Updating comment...`
      )
    }
  }

  const cancelEdit = () => setEditing(null)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitEdit()
    else if (e.key === 'Escape') cancelEdit()
  }

  const handleTypeChange = (colIndex: number, newType: string) => {
    const col = filtered[colIndex]
    if (!col || newType === col.type) return

    if (isTypeCategoryChange(col.type, newType)) {
      setTypeChangeDialog({ colName: col.name, oldType: col.type, newType })
      setTypeChangeSize('')
    } else {
      const size = TYPES_REQUIRING_SIZE.has(newType) ? formatSize(col) || undefined : undefined
      executeAndRefresh(
        buildModifyTypeSQL(schema, table, col.name, newType, size),
        `Changed ${col.name} type to ${newType}`,
        `Changing type...`
      )
    }
  }

  const confirmTypeChange = () => {
    if (!typeChangeDialog) return
    const { colName, newType } = typeChangeDialog
    const size = TYPES_REQUIRING_SIZE.has(newType) && typeChangeSize ? typeChangeSize : undefined
    setTypeChangeDialog(null)
    executeAndRefresh(
      buildModifyTypeSQL(schema, table, colName, newType, size),
      `Changed ${colName} type to ${newType}`,
      `Changing type...`
    )
  }

  const handleNullableToggle = (colIndex: number) => {
    const col = filtered[colIndex]
    if (!col) return
    executeAndRefresh(
      buildModifyNullableSQL(schema, table, col.name, col.nullable),
      `${col.name} set to ${col.nullable ? 'NOT NULL' : 'NULL'}`,
      `Modifying constraint...`
    )
  }

  const handleAddColumn = () => {
    if (!newCol.name.trim() || !newCol.type) return
    const nameError = validateColumnName(newCol.name.trim())
    if (nameError) { toast.error('Invalid name', { description: nameError }); return }
    if (newCol.notNull && !newCol.defaultValue.trim()) {
      toast.error('Default required', { description: 'NOT NULL columns need a DEFAULT value when table has existing rows' })
      return
    }
    const size = TYPES_REQUIRING_SIZE.has(newCol.type) && newCol.size ? newCol.size : undefined
    const def = newCol.defaultValue.trim() || undefined
    executeAndRefresh(
      buildAddColumnSQL(schema, table, newCol.name.trim(), newCol.type, size, newCol.notNull, def),
      `Added column ${newCol.name.trim()}`,
      `Adding column...`
    )
    setNewCol(INITIAL_NEW_COL)
  }

  const confirmDelete = () => {
    if (!deleteColumn) return
    const colName = deleteColumn
    setDeleteColumn(null)
    executeAndRefresh(buildDropColumnSQL(schema, table, colName), `Dropped column ${colName}`, `Dropping column...`)
  }

  const filtered = filter
    ? columns.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()))
    : columns

  const unknownTypes = collectUnknownTypes(columns)

  const renderEditableCell = (
    rowIndex: number,
    field: EditingCell['field'],
    value: string,
    extraClass?: string
  ) => {
    const isEditing = editing?.row === rowIndex && editing?.field === field
    if (isEditing) {
      return (
        <input
          ref={inputRef}
          className="w-full bg-transparent border border-cyan-500/60 rounded px-1 py-0.5 text-xs outline-none"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
        />
      )
    }
    return (
      <span
        className={cn('cursor-pointer rounded px-1 py-0.5 -mx-1 hover:bg-muted/50 transition-colors', extraClass)}
        onClick={() => startEdit(rowIndex, field, value)}
      >
        {value}
      </span>
    )
  }

  if (loading) {
    return <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">Loading columns...</div>
  }

  if (error) {
    return <div className="flex items-center justify-center h-32 text-sm text-destructive">{error}</div>
  }

  if (columns.length === 0) {
    return <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">No columns found</div>
  }

  const canAdd = newCol.name.trim() && newCol.type

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="relative px-3 py-2 shrink-0">
        <Search className="absolute left-6 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Filter columns..."
          className="pl-8 h-7 text-xs"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="relative flex-1 min-h-0 overflow-auto">
        {/* Saving overlay */}
        {savingLabel && (
          <div className="absolute inset-0 z-20 pointer-events-none">
            <div className="h-[2px] overflow-hidden bg-cyan-500/10">
              <div
                className="h-full w-1/4 bg-gradient-to-r from-transparent via-cyan-400 to-transparent rounded-full"
                style={{ animation: 'sql-shimmer 1.2s ease-in-out infinite' }}
              />
            </div>
            <div className="absolute inset-0 bg-[#1a1b1e]/40" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 bg-[#1e1f23] border border-border/60 rounded-lg px-4 py-2 shadow-lg">
              <Loader2 className="h-3.5 w-3.5 text-cyan-400 animate-spin" />
              <span className="text-xs text-muted-foreground">{savingLabel}</span>
            </div>
          </div>
        )}
        <table className={cn('w-full border-collapse text-xs font-mono transition-opacity duration-200', savingLabel && 'opacity-50')}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#1e1f23]">
              <th className="w-8 px-2 py-1.5 text-center border-b border-r border-border" />
              <th className="px-3 py-1.5 text-left font-medium border-b border-r border-border">Column</th>
              <th className="px-3 py-1.5 text-left font-medium border-b border-r border-border">Type</th>
              <th className="px-3 py-1.5 text-left font-medium border-b border-r border-border">Size</th>
              <th className="px-3 py-1.5 text-center font-medium border-b border-r border-border">Not Null</th>
              <th className="px-3 py-1.5 text-left font-medium border-b border-r border-border">Default</th>
              <th className="px-3 py-1.5 text-left font-medium border-b border-r border-border">Comment</th>
              <th className="w-8 px-2 py-1.5 text-center border-b border-border" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((col, i) => (
              <tr
                key={col.name}
                className={cn('hover:bg-[#1e1f23]', i % 2 === 1 && 'bg-[#1a1b1e]/50')}
                onMouseEnter={() => setHoveredRow(i)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                <td className="px-2 py-1 text-center border-r border-border">
                  {col.isPrimaryKey && <KeyRound className="h-3 w-3 text-blue-400 inline" />}
                </td>
                <td className="px-3 py-1 border-r border-border font-medium">
                  {renderEditableCell(i, 'name', col.name)}
                </td>
                <td className="px-3 py-1 border-r border-border text-muted-foreground">
                  {editingTypeRow === i ? (
                    <TypeSelectDropdown
                      value={col.type}
                      unknownTypes={unknownTypes}
                      onValueChange={(v) => { setEditingTypeRow(null); handleTypeChange(i, v) }}
                      onOpenChange={() => setEditingTypeRow(null)}
                    />
                  ) : (
                    <span
                      className="cursor-pointer rounded px-1 py-0.5 -mx-1 hover:bg-muted/50 transition-colors"
                      onClick={() => setEditingTypeRow(i)}
                    >
                      {col.type}
                    </span>
                  )}
                </td>
                <td className="px-3 py-1 border-r border-border text-muted-foreground">
                  {renderEditableCell(i, 'size', formatSize(col))}
                </td>
                <td className="px-3 py-1 text-center border-r border-border">
                  <button
                    className={cn(
                      'px-1.5 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer',
                      !col.nullable ? 'text-amber-400 hover:text-amber-300' : 'text-muted-foreground/40 hover:text-muted-foreground'
                    )}
                    onClick={() => handleNullableToggle(i)}
                    disabled={!!savingLabel}
                  >
                    {!col.nullable ? 'Y' : '\u2014'}
                  </button>
                </td>
                <td className="px-3 py-1 border-r border-border text-muted-foreground truncate max-w-[200px]">
                  {renderEditableCell(i, 'default', col.defaultValue ?? '')}
                </td>
                <td className="px-3 py-1 border-r border-border text-muted-foreground truncate max-w-[200px]">
                  {renderEditableCell(i, 'comment', col.comments ?? '')}
                </td>
                <td className="px-2 py-1 text-center border-border">
                  {hoveredRow === i && !col.isPrimaryKey && (
                    <button
                      className="text-muted-foreground/40 hover:text-red-400 transition-colors cursor-pointer"
                      onClick={() => setDeleteColumn(col.name)}
                      disabled={!!savingLabel}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add new column — pinned footer */}
      <div className="shrink-0 border-t border-border/60 bg-[#1e1f23]/80 px-3 py-2">
        <div className="flex items-center gap-2">
          <Plus className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
          <input
            className="w-28 bg-[#161719] border border-border/50 rounded px-2 py-1 text-xs font-mono outline-none focus:border-cyan-500/50 placeholder:text-muted-foreground/30"
            placeholder="Name"
            value={newCol.name}
            onChange={(e) => setNewCol({ ...newCol, name: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter' && canAdd) handleAddColumn() }}
          />
          <Select value={newCol.type || undefined} onValueChange={(v) => setNewCol({ ...newCol, type: v })}>
            <SelectTrigger className="h-[26px] w-28 bg-[#161719] border-border/50 px-2 py-1 text-xs font-mono shadow-none gap-1">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {Object.entries(ORACLE_TYPE_GROUPS).map(([group, types]) => (
                <SelectGroup key={group}>
                  <SelectLabel>{group}</SelectLabel>
                  {types.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs font-mono">{t}</SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <input
            className="w-16 bg-[#161719] border border-border/50 rounded px-2 py-1 text-xs font-mono outline-none focus:border-cyan-500/50 placeholder:text-muted-foreground/30 disabled:opacity-30 disabled:cursor-not-allowed"
            placeholder="Size"
            value={newCol.size}
            onChange={(e) => setNewCol({ ...newCol, size: e.target.value })}
            disabled={!newCol.type || !TYPES_REQUIRING_SIZE.has(newCol.type)}
          />
          <button
            className={cn(
              'shrink-0 border rounded px-2 py-1 text-xs font-medium transition-colors cursor-pointer',
              newCol.notNull
                ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                : 'border-border/50 text-muted-foreground/40 hover:text-muted-foreground bg-[#161719]'
            )}
            onClick={() => setNewCol({ ...newCol, notNull: !newCol.notNull })}
          >
            {newCol.notNull ? 'NOT NULL' : 'NULL'}
          </button>
          <input
            className={cn(
              'w-24 bg-[#161719] border rounded px-2 py-1 text-xs font-mono outline-none focus:border-cyan-500/50',
              newCol.notNull && !newCol.defaultValue.trim()
                ? 'border-amber-500/50 placeholder:text-amber-400/50'
                : 'border-border/50 placeholder:text-muted-foreground/30'
            )}
            placeholder={newCol.notNull ? 'Required' : 'Default'}
            value={newCol.defaultValue}
            onChange={(e) => setNewCol({ ...newCol, defaultValue: e.target.value })}
          />
          <button
            className={cn(
              'shrink-0 flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-all cursor-pointer',
              canAdd
                ? 'bg-cyan-600/90 hover:bg-cyan-500 text-white'
                : 'bg-muted/30 text-muted-foreground/30 cursor-not-allowed'
            )}
            onClick={handleAddColumn}
            disabled={!canAdd || !!savingLabel}
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>
      </div>

      {/* Type change warning dialog */}
      <Dialog open={!!typeChangeDialog} onOpenChange={(open) => { if (!open) setTypeChangeDialog(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Type category change
            </DialogTitle>
            <DialogDescription className="text-sm pt-2">
              You are changing <code className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs">{typeChangeDialog?.colName}</code> from{' '}
              <code className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs">{typeChangeDialog?.oldType}</code> to{' '}
              <code className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs">{typeChangeDialog?.newType}</code>.
              This crosses type categories and may result in data loss or conversion errors for existing rows.
            </DialogDescription>
          </DialogHeader>
          {typeChangeDialog && TYPES_REQUIRING_SIZE.has(typeChangeDialog.newType) && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Size:</label>
              <Input
                className="h-7 text-xs w-32"
                placeholder="e.g. 255"
                value={typeChangeSize}
                onChange={(e) => setTypeChangeSize(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <button
              className="px-3 py-1.5 text-xs rounded border border-border hover:bg-muted transition-colors cursor-pointer"
              onClick={() => setTypeChangeDialog(null)}
            >
              Cancel
            </button>
            <button
              className="px-3 py-1.5 text-xs rounded bg-amber-600 hover:bg-amber-500 text-white transition-colors cursor-pointer"
              onClick={confirmTypeChange}
            >
              Change Type
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteColumn} onOpenChange={(open) => { if (!open) setDeleteColumn(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Drop column
            </DialogTitle>
            <DialogDescription className="text-sm pt-2">
              This will permanently remove <code className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs">{deleteColumn}</code> and
              all of its data from the table. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              className="px-3 py-1.5 text-xs rounded border border-border hover:bg-muted transition-colors cursor-pointer"
              onClick={() => setDeleteColumn(null)}
            >
              Cancel
            </button>
            <button
              className="px-3 py-1.5 text-xs rounded bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer"
              onClick={confirmDelete}
            >
              Drop Column
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
