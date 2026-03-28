import { type FC, type ReactNode } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Play,
  ListOrdered,
  Copy,
  ClipboardCopy,
  FileCode,
  FileInput,
  FileOutput,
  Hash,
  Trash2,
  Eraser,
  Power,
  PowerOff,
  RefreshCw,
} from 'lucide-react'
import { useSQL } from '@/ui/contexts/sql'
import { useViews } from '@/ui/contexts/views'
import { toast } from 'sonner'

type ObjectType = 'tables' | 'views' | 'sequences' | 'procedures' | 'functions' | 'packages' | 'triggers'

interface SchemaObjectContextMenuProps {
  children: ReactNode
  objectName: string
  objectType: ObjectType
  schema: string
}

export const SchemaObjectContextMenu: FC<SchemaObjectContextMenuProps> = ({
  children,
  objectName,
  objectType,
  schema,
}) => {
  const {
    setEditorSqlAndExecute,
    setEditorSql,
    executeQuery,
    getTableColumns,
    getObjectDDL,
    getTableRowCount,
  } = useSQL()
  const { updateView } = useViews()

  const qualifiedName = `"${schema}"."${objectName}"`

  const handleCopyName = () => {
    navigator.clipboard.writeText(objectName)
    toast.success('Copied', { description: objectName })
  }

  const handleCopyQualifiedName = () => {
    navigator.clipboard.writeText(`${schema}.${objectName}`)
    toast.success('Copied', { description: `${schema}.${objectName}` })
  }

  const handleQueryAll = () => {
    setEditorSqlAndExecute(`SELECT * FROM ${qualifiedName}`)
  }

  const handleQueryTop100 = () => {
    setEditorSqlAndExecute(`SELECT * FROM ${qualifiedName} WHERE ROWNUM <= 100`)
  }

  const handleOpenTable = () => {
    updateView('sql' as never, `table:${schema}.${objectName}`)
  }

  const handleGenerateSelect = async () => {
    try {
      const columns = await getTableColumns(schema, objectName)
      const colNames = columns.map((c) => `  ${c.name}`).join(',\n')
      setEditorSql(`SELECT\n${colNames}\nFROM ${qualifiedName}`)
    } catch {
      setEditorSql(`SELECT * FROM ${qualifiedName}`)
    }
  }

  const handleGenerateInsert = async () => {
    try {
      const columns = await getTableColumns(schema, objectName)
      const colNames = columns.map((c) => c.name).join(', ')
      const placeholders = columns.map(() => '?').join(', ')
      setEditorSql(`INSERT INTO ${qualifiedName} (${colNames})\nVALUES (${placeholders})`)
    } catch {
      setEditorSql(`INSERT INTO ${qualifiedName} ()\nVALUES ()`)
    }
  }

  const handleRowCount = async () => {
    try {
      const count = await getTableRowCount(schema, objectName)
      toast.success(`${objectName}`, { description: `${count.toLocaleString()} rows` })
    } catch (err) {
      toast.error('Failed', { description: err instanceof Error ? err.message : 'Could not count rows' })
    }
  }

  const handleViewDDL = async () => {
    const typeMap: Record<ObjectType, string> = {
      tables: 'TABLE',
      views: 'VIEW',
      sequences: 'SEQUENCE',
      procedures: 'PROCEDURE',
      functions: 'FUNCTION',
      packages: 'PACKAGE',
      triggers: 'TRIGGER',
    }
    try {
      const ddl = await getObjectDDL(schema, objectName, typeMap[objectType])
      setEditorSql(ddl)
    } catch (err) {
      toast.error('DDL Error', { description: err instanceof Error ? err.message : 'Failed to get DDL' })
    }
  }

  const handleDropObject = async () => {
    const typeMap: Record<ObjectType, string> = {
      tables: 'TABLE',
      views: 'VIEW',
      sequences: 'SEQUENCE',
      procedures: 'PROCEDURE',
      functions: 'FUNCTION',
      packages: 'PACKAGE',
      triggers: 'TRIGGER',
    }
    const confirmed = window.confirm(`Are you sure you want to DROP ${typeMap[objectType]} ${schema}.${objectName}?`)
    if (!confirmed) return
    try {
      await executeQuery(`DROP ${typeMap[objectType]} ${qualifiedName}`)
      toast.success('Dropped', { description: `${typeMap[objectType]} ${objectName}` })
    } catch (err) {
      toast.error('Drop failed', { description: err instanceof Error ? err.message : 'Operation failed' })
    }
  }

  const handleTruncateTable = async () => {
    const confirmed = window.confirm(`Are you sure you want to TRUNCATE TABLE ${schema}.${objectName}? This cannot be undone.`)
    if (!confirmed) return
    try {
      await executeQuery(`TRUNCATE TABLE ${qualifiedName}`)
      toast.success('Truncated', { description: objectName })
    } catch (err) {
      toast.error('Truncate failed', { description: err instanceof Error ? err.message : 'Operation failed' })
    }
  }

  const handleCompile = async () => {
    const typeMap: Record<string, string> = {
      procedures: 'PROCEDURE',
      functions: 'FUNCTION',
      packages: 'PACKAGE',
      triggers: 'TRIGGER',
    }
    try {
      await executeQuery(`ALTER ${typeMap[objectType]} ${qualifiedName} COMPILE`)
      toast.success('Compiled', { description: objectName })
    } catch (err) {
      toast.error('Compile failed', { description: err instanceof Error ? err.message : 'Compilation error' })
    }
  }

  const handleEnableDisableTrigger = async (enable: boolean) => {
    try {
      await executeQuery(`ALTER TRIGGER ${qualifiedName} ${enable ? 'ENABLE' : 'DISABLE'}`)
      toast.success(enable ? 'Enabled' : 'Disabled', { description: objectName })
    } catch (err) {
      toast.error('Failed', { description: err instanceof Error ? err.message : 'Operation failed' })
    }
  }

  const handleGetCurrentValue = async () => {
    try {
      const result = await executeQuery(`SELECT ${qualifiedName}.CURRVAL FROM DUAL`)
      const val = result?.rows?.[0]?.[0]
      toast.success(objectName, { description: `Current value: ${val}` })
    } catch {
      toast.error('Failed', { description: 'Cannot get CURRVAL (sequence may not have been used in this session)' })
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {/* Table-specific items */}
        {objectType === 'tables' && (
          <>
            <ContextMenuItem onClick={handleQueryAll}>
              <Play className="h-4 w-4 mr-2" />
              Query All
            </ContextMenuItem>
            <ContextMenuItem onClick={handleQueryTop100}>
              <ListOrdered className="h-4 w-4 mr-2" />
              Query Top 100
            </ContextMenuItem>
            <ContextMenuItem onClick={handleOpenTable}>
              <FileCode className="h-4 w-4 mr-2" />
              Open Table
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleCopyName}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Name
            </ContextMenuItem>
            <ContextMenuItem onClick={handleCopyQualifiedName}>
              <ClipboardCopy className="h-4 w-4 mr-2" />
              Copy Qualified Name
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleGenerateSelect}>
              <FileInput className="h-4 w-4 mr-2" />
              Generate SELECT
            </ContextMenuItem>
            <ContextMenuItem onClick={handleGenerateInsert}>
              <FileOutput className="h-4 w-4 mr-2" />
              Generate INSERT
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleRowCount}>
              <Hash className="h-4 w-4 mr-2" />
              Row Count
            </ContextMenuItem>
            <ContextMenuItem onClick={handleViewDDL}>
              <FileCode className="h-4 w-4 mr-2" />
              View DDL
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleTruncateTable} className="text-amber-400 focus:text-amber-400">
              <Eraser className="h-4 w-4 mr-2" />
              Truncate Table
            </ContextMenuItem>
            <ContextMenuItem onClick={handleDropObject} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Drop Table
            </ContextMenuItem>
          </>
        )}

        {/* View-specific items */}
        {objectType === 'views' && (
          <>
            <ContextMenuItem onClick={handleQueryAll}>
              <Play className="h-4 w-4 mr-2" />
              Query All
            </ContextMenuItem>
            <ContextMenuItem onClick={handleQueryTop100}>
              <ListOrdered className="h-4 w-4 mr-2" />
              Query Top 100
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleCopyName}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Name
            </ContextMenuItem>
            <ContextMenuItem onClick={handleCopyQualifiedName}>
              <ClipboardCopy className="h-4 w-4 mr-2" />
              Copy Qualified Name
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleViewDDL}>
              <FileCode className="h-4 w-4 mr-2" />
              View DDL
            </ContextMenuItem>
            <ContextMenuItem onClick={handleDropObject} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Drop View
            </ContextMenuItem>
          </>
        )}

        {/* Procedure/Function/Package items */}
        {(objectType === 'procedures' || objectType === 'functions' || objectType === 'packages') && (
          <>
            <ContextMenuItem onClick={handleCopyName}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Name
            </ContextMenuItem>
            <ContextMenuItem onClick={handleCopyQualifiedName}>
              <ClipboardCopy className="h-4 w-4 mr-2" />
              Copy Qualified Name
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleViewDDL}>
              <FileCode className="h-4 w-4 mr-2" />
              View DDL
            </ContextMenuItem>
            <ContextMenuItem onClick={handleCompile}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Compile
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleDropObject} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Drop
            </ContextMenuItem>
          </>
        )}

        {/* Sequence items */}
        {objectType === 'sequences' && (
          <>
            <ContextMenuItem onClick={handleCopyName}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Name
            </ContextMenuItem>
            <ContextMenuItem onClick={handleCopyQualifiedName}>
              <ClipboardCopy className="h-4 w-4 mr-2" />
              Copy Qualified Name
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleViewDDL}>
              <FileCode className="h-4 w-4 mr-2" />
              View DDL
            </ContextMenuItem>
            <ContextMenuItem onClick={handleGetCurrentValue}>
              <Hash className="h-4 w-4 mr-2" />
              Get Current Value
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleDropObject} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Drop Sequence
            </ContextMenuItem>
          </>
        )}

        {/* Trigger items */}
        {objectType === 'triggers' && (
          <>
            <ContextMenuItem onClick={handleCopyName}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Name
            </ContextMenuItem>
            <ContextMenuItem onClick={handleCopyQualifiedName}>
              <ClipboardCopy className="h-4 w-4 mr-2" />
              Copy Qualified Name
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleViewDDL}>
              <FileCode className="h-4 w-4 mr-2" />
              View DDL
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleEnableDisableTrigger(true)}>
              <Power className="h-4 w-4 mr-2" />
              Enable
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleEnableDisableTrigger(false)}>
              <PowerOff className="h-4 w-4 mr-2" />
              Disable
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleDropObject} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Drop Trigger
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
