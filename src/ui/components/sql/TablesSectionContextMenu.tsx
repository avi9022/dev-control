import { type FC, type ReactNode } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { RefreshCw, Hash, FileCode, Eraser } from 'lucide-react'
import { useSQL } from '@/ui/contexts/sql'
import { toast } from 'sonner'

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

interface TablesSectionContextMenuProps {
  children: ReactNode
  schema: string
  tables: SQLTableInfo[]
}

export const TablesSectionContextMenu: FC<TablesSectionContextMenuProps> = ({
  children,
  schema,
  tables,
}) => {
  const { refreshSchema, executeQuery, getTableRowCount, setEditorSql } = useSQL()

  const handleRefresh = async () => {
    try {
      await refreshSchema()
      toast.success('Schema refreshed')
    } catch (err) {
      toast.error('Refresh failed', {
        description: err instanceof Error ? err.message : 'Could not refresh schema',
      })
    }
  }

  const handleRowCountAll = async () => {
    if (tables.length === 0) {
      toast.info('No tables', { description: 'No tables found in this schema' })
      return
    }

    const toastId = toast.loading(`Counting rows for ${tables.length} tables...`)
    const results: { name: string; count: number }[] = []
    const failures: string[] = []

    for (const table of tables) {
      try {
        const count = await getTableRowCount(schema, table.name)
        results.push({ name: table.name, count })
      } catch {
        failures.push(table.name)
      }
    }

    const totalRows = results.reduce((sum, r) => sum + r.count, 0)
    const summary = results
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((r) => `${r.name}: ${r.count.toLocaleString()}`)
      .join('\n')

    const description = [
      `Total: ${totalRows.toLocaleString()} rows across ${results.length} tables`,
      summary,
      results.length > 10 ? `...and ${results.length - 10} more` : '',
      failures.length > 0 ? `${failures.length} tables failed` : '',
    ]
      .filter(Boolean)
      .join('\n')

    toast.dismiss(toastId)
    toast.success('Row Counts', { description, duration: 8000 })
  }

  const handleGenerateSelectAll = () => {
    if (tables.length === 0) {
      toast.info('No tables', { description: 'No tables found in this schema' })
      return
    }

    const sql = tables
      .map((t) => `SELECT * FROM ${quoteIdentifier(schema)}.${quoteIdentifier(t.name)};`)
      .join('\n')
    setEditorSql(sql)
    toast.success('Generated', {
      description: `SELECT statements for ${tables.length} tables`,
    })
  }

  const handleTruncateAll = async () => {
    if (tables.length === 0) {
      toast.info('No tables', { description: 'No tables found in this schema' })
      return
    }

    const confirmed = window.confirm(
      `Are you sure you want to TRUNCATE ALL ${tables.length} tables in schema "${schema}"?\n\nThis will permanently delete all data and cannot be undone.`
    )
    if (!confirmed) return

    const doubleConfirmed = window.confirm(
      `FINAL WARNING: This will truncate ${tables.length} tables in "${schema}".\n\nType-check: You are about to delete ALL data from:\n${tables
        .slice(0, 5)
        .map((t) => `  - ${t.name}`)
        .join('\n')}${tables.length > 5 ? `\n  ...and ${tables.length - 5} more` : ''}\n\nProceed?`
    )
    if (!doubleConfirmed) return

    let successCount = 0
    const failures: { name: string; error: string }[] = []
    const toastId = toast.loading(`Truncating table 1 of ${tables.length}...`)

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i]
      toast.loading(`Truncating table ${i + 1} of ${tables.length}: ${table.name}`, {
        id: toastId,
      })

      try {
        await executeQuery(`TRUNCATE TABLE ${quoteIdentifier(schema)}.${quoteIdentifier(table.name)}`)
        successCount++
      } catch (err) {
        failures.push({
          name: table.name,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    toast.dismiss(toastId)

    if (failures.length === 0) {
      toast.success('Truncate All Complete', {
        description: `Truncated ${successCount}/${tables.length} tables`,
      })
    } else {
      const failureDetails = failures
        .slice(0, 5)
        .map((f) => `${f.name}: ${f.error}`)
        .join('\n')
      toast.warning('Truncate All Partial', {
        description: [
          `Truncated ${successCount}/${tables.length} tables. ${failures.length} failed:`,
          failureDetails,
          failures.length > 5 ? `...and ${failures.length - 5} more` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        duration: 10000,
      })
    }

    try {
      await refreshSchema()
    } catch {
      // refresh is best-effort after truncation
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </ContextMenuItem>
        <ContextMenuItem onClick={handleRowCountAll}>
          <Hash className="h-4 w-4 mr-2" />
          Row Count All
        </ContextMenuItem>
        <ContextMenuItem onClick={handleGenerateSelectAll}>
          <FileCode className="h-4 w-4 mr-2" />
          Generate SELECT All
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={handleTruncateAll}
          className="text-destructive focus:text-destructive"
        >
          <Eraser className="h-4 w-4 mr-2" />
          Truncate All
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
