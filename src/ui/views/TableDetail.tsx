import { useState, useEffect, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft, RefreshCw, Table2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useViews } from '@/ui/contexts/views'
import { useSQL } from '@/ui/contexts/sql'
import { TableColumnsTab } from '@/ui/components/sql/table-detail/TableColumnsTab'
import { TableDataTab } from '@/ui/components/sql/table-detail/TableDataTab'
import { TableConstraintsTab } from '@/ui/components/sql/table-detail/TableConstraintsTab'
import { TableIndexesTab } from '@/ui/components/sql/table-detail/TableIndexesTab'
import { TableTriggersTab } from '@/ui/components/sql/table-detail/TableTriggersTab'
import { TableDDLTab } from '@/ui/components/sql/table-detail/TableDDLTab'
import { TableGrantsTab } from '@/ui/components/sql/table-detail/TableGrantsTab'

interface TableDetailProps {
  schema: string
  table: string
}

type TabId = 'columns' | 'data' | 'constraints' | 'indexes' | 'triggers' | 'ddl' | 'grants'

const TABS: { id: TabId; label: string }[] = [
  { id: 'columns', label: 'Columns' },
  { id: 'data', label: 'Data' },
  { id: 'constraints', label: 'Constraints' },
  { id: 'indexes', label: 'Indexes' },
  { id: 'triggers', label: 'Triggers' },
  { id: 'ddl', label: 'DDL' },
  { id: 'grants', label: 'Grants' },
]

export const TableDetailView: FC<TableDetailProps> = ({ schema, table }) => {
  const [activeTab, setActiveTab] = useState<TabId>('columns')
  const [rowCount, setRowCount] = useState<number | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const { updateView } = useViews()
  const { columnMap } = useSQL()
  const tableColumns = columnMap[table.toUpperCase()] ?? columnMap[table] ?? []

  useEffect(() => {
    window.electron.sqlGetTableRowCount(schema, table)
      .then(setRowCount)
      .catch(() => setRowCount(null))
  }, [schema, table, refreshKey])

  const handleBack = () => {
    updateView('sql' as never, null)
  }

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1)
  }

  return (
    <div className="h-full flex flex-col bg-[#1a1b1e]">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-[#1e1f23]">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleBack}
          title="Back to SQL Editor"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Table2 className="h-4 w-4 text-muted-foreground" />
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{schema}.{table}</span>
          {rowCount !== null && (
            <span className="text-xs text-muted-foreground">
              ({rowCount.toLocaleString()} rows)
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 ml-auto"
          onClick={handleRefresh}
          title="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Tab bar */}
      <div className="flex items-center border-b border-border bg-[#1e1f23]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-xs font-medium transition-colors border-b-2',
              activeTab === tab.id
                ? 'border-[#c74634] text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'columns' && <TableColumnsTab key={refreshKey} schema={schema} table={table} />}
        {activeTab === 'data' && <TableDataTab key={refreshKey} schema={schema} table={table} columns={tableColumns} />}
        {activeTab === 'constraints' && <TableConstraintsTab key={refreshKey} schema={schema} table={table} />}
        {activeTab === 'indexes' && <TableIndexesTab key={refreshKey} schema={schema} table={table} />}
        {activeTab === 'triggers' && <TableTriggersTab key={refreshKey} schema={schema} table={table} />}
        {activeTab === 'ddl' && <TableDDLTab key={refreshKey} schema={schema} table={table} />}
        {activeTab === 'grants' && <TableGrantsTab key={refreshKey} schema={schema} table={table} />}
      </div>
    </div>
  )
}
