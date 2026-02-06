import { useState, useEffect, type FC } from 'react'
import { cn } from '@/lib/utils'

interface TableIndexesTabProps {
  schema: string
  table: string
}

export const TableIndexesTab: FC<TableIndexesTabProps> = ({ schema, table }) => {
  const [indexes, setIndexes] = useState<SQLIndex[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.electron.sqlGetTableIndexes(schema, table)
      .then(setIndexes)
      .catch((err) => {
        setIndexes([])
        setError(err instanceof Error ? err.message : 'Failed to load indexes')
      })
      .finally(() => setLoading(false))
  }, [schema, table])

  if (loading) {
    return <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">Loading indexes...</div>
  }

  if (error) {
    return <div className="flex items-center justify-center h-32 text-sm text-destructive">{error}</div>
  }

  if (indexes.length === 0) {
    return <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">No indexes found</div>
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full border-collapse text-xs font-mono">
        <thead className="sticky top-0 z-10">
          <tr className="bg-[#1e1f23]">
            <th className="px-3 py-1.5 text-left font-medium border-b border-r border-border">Name</th>
            <th className="px-3 py-1.5 text-left font-medium border-b border-r border-border">Columns</th>
            <th className="px-3 py-1.5 text-center font-medium border-b border-r border-border">Unique</th>
            <th className="px-3 py-1.5 text-left font-medium border-b border-r border-border">Type</th>
            <th className="px-3 py-1.5 text-left font-medium border-b border-r border-border">Tablespace</th>
            <th className="px-3 py-1.5 text-left font-medium border-b border-border">Status</th>
          </tr>
        </thead>
        <tbody>
          {indexes.map((idx, i) => (
            <tr key={idx.name} className={cn('hover:bg-[#1e1f23]', i % 2 === 1 && 'bg-[#1a1b1e]/50')}>
              <td className="px-3 py-1 border-r border-border">{idx.name}</td>
              <td className="px-3 py-1 border-r border-border text-muted-foreground">{idx.columns.join(', ')}</td>
              <td className="px-3 py-1 text-center border-r border-border">
                {idx.isUnique && <span className="text-purple-400">Y</span>}
              </td>
              <td className="px-3 py-1 border-r border-border text-muted-foreground">{idx.type}</td>
              <td className="px-3 py-1 border-r border-border text-muted-foreground">{idx.tablespace ?? ''}</td>
              <td className="px-3 py-1">
                <span className={cn('text-[10px]', idx.status === 'VALID' ? 'text-green-400' : 'text-red-400')}>
                  {idx.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
