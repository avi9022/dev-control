import { useState, useEffect, type FC } from 'react'
import { cn } from '@/lib/utils'

interface TableConstraintsTabProps {
  schema: string
  table: string
}

const TYPE_COLORS: Record<string, string> = {
  PRIMARY: 'bg-blue-500/20 text-blue-400',
  FOREIGN_KEY: 'bg-green-500/20 text-green-400',
  UNIQUE: 'bg-purple-500/20 text-purple-400',
  CHECK: 'bg-amber-500/20 text-amber-400',
  NOT_NULL: 'bg-gray-500/20 text-gray-400',
}

export const TableConstraintsTab: FC<TableConstraintsTabProps> = ({ schema, table }) => {
  const [constraints, setConstraints] = useState<SQLConstraint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.electron.sqlGetTableConstraints(schema, table)
      .then(setConstraints)
      .catch((err) => {
        setConstraints([])
        setError(err instanceof Error ? err.message : 'Failed to load constraints')
      })
      .finally(() => setLoading(false))
  }, [schema, table])

  if (loading) {
    return <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">Loading constraints...</div>
  }

  if (error) {
    return <div className="flex items-center justify-center h-32 text-sm text-destructive">{error}</div>
  }

  if (constraints.length === 0) {
    return <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">No constraints found</div>
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full border-collapse text-xs font-mono">
        <thead className="sticky top-0 z-10">
          <tr className="bg-[#1e1f23]">
            <th className="px-3 py-1.5 text-left font-medium border-b border-r border-border">Name</th>
            <th className="px-3 py-1.5 text-left font-medium border-b border-r border-border">Type</th>
            <th className="px-3 py-1.5 text-left font-medium border-b border-r border-border">Columns</th>
            <th className="px-3 py-1.5 text-left font-medium border-b border-r border-border">Referenced Table</th>
            <th className="px-3 py-1.5 text-left font-medium border-b border-r border-border">Status</th>
          </tr>
        </thead>
        <tbody>
          {constraints.map((c, i) => (
            <tr key={c.name} className={cn('hover:bg-[#1e1f23]', i % 2 === 1 && 'bg-[#1a1b1e]/50')}>
              <td className="px-3 py-1 border-r border-border">{c.name}</td>
              <td className="px-3 py-1 border-r border-border">
                <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', TYPE_COLORS[c.type] ?? 'bg-gray-500/20 text-gray-400')}>
                  {c.type.replace('_', ' ')}
                </span>
              </td>
              <td className="px-3 py-1 border-r border-border text-muted-foreground">{c.columns.join(', ')}</td>
              <td className="px-3 py-1 border-r border-border text-muted-foreground">
                {c.refTable ? `${c.refTable}(${c.refColumns?.join(', ') ?? ''})` : ''}
              </td>
              <td className="px-3 py-1 border-r border-border">
                <span className={cn('text-[10px]', c.status === 'ENABLED' ? 'text-green-400' : 'text-red-400')}>
                  {c.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
