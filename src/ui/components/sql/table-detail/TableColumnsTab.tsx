import { useState, useEffect, type FC } from 'react'
import { KeyRound, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface TableColumnsTabProps {
  schema: string
  table: string
}

export const TableColumnsTab: FC<TableColumnsTabProps> = ({ schema, table }) => {
  const [columns, setColumns] = useState<SQLColumnDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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

  const filtered = filter
    ? columns.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()))
    : columns

  if (loading) {
    return <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">Loading columns...</div>
  }

  if (error) {
    return <div className="flex items-center justify-center h-32 text-sm text-destructive">{error}</div>
  }

  if (columns.length === 0) {
    return <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">No columns found</div>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="relative px-3 py-2">
        <Search className="absolute left-6 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Filter columns..."
          className="pl-8 h-7 text-xs"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs font-mono">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#1e1f23]">
              <th className="w-8 px-2 py-1.5 text-center border-b border-r border-border" />
              <th className="px-3 py-1.5 text-left font-medium border-b border-r border-border">Column</th>
              <th className="px-3 py-1.5 text-left font-medium border-b border-r border-border">Type</th>
              <th className="px-3 py-1.5 text-left font-medium border-b border-r border-border">Size</th>
              <th className="px-3 py-1.5 text-center font-medium border-b border-r border-border">Not Null</th>
              <th className="px-3 py-1.5 text-left font-medium border-b border-r border-border">Default</th>
              <th className="px-3 py-1.5 text-left font-medium border-b border-border">Comment</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((col, i) => (
              <tr key={col.name} className={cn('hover:bg-[#1e1f23]', i % 2 === 1 && 'bg-[#1a1b1e]/50')}>
                <td className="px-2 py-1 text-center border-r border-border">
                  {col.isPrimaryKey && <KeyRound className="h-3 w-3 text-blue-400 inline" />}
                </td>
                <td className="px-3 py-1 border-r border-border font-medium">{col.name}</td>
                <td className="px-3 py-1 border-r border-border text-muted-foreground">{col.type}</td>
                <td className="px-3 py-1 border-r border-border text-muted-foreground">
                  {col.precision != null ? `${col.precision}${col.scale ? `,${col.scale}` : ''}` : col.maxLength ?? ''}
                </td>
                <td className="px-3 py-1 text-center border-r border-border">
                  {!col.nullable && <span className="text-amber-400">Y</span>}
                </td>
                <td className="px-3 py-1 border-r border-border text-muted-foreground truncate max-w-[200px]">
                  {col.defaultValue ?? ''}
                </td>
                <td className="px-3 py-1 text-muted-foreground truncate max-w-[200px]">
                  {col.comments ?? ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
