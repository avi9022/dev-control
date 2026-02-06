import { useState, useEffect, type FC } from 'react'
import { cn } from '@/lib/utils'

interface TableGrantsTabProps {
  schema: string
  table: string
}

export const TableGrantsTab: FC<TableGrantsTabProps> = ({ schema, table }) => {
  const [grants, setGrants] = useState<SQLGrant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.electron.sqlGetTableGrants(schema, table)
      .then(setGrants)
      .catch((err) => {
        setGrants([])
        setError(err instanceof Error ? err.message : 'Failed to load grants')
      })
      .finally(() => setLoading(false))
  }, [schema, table])

  if (loading) {
    return <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">Loading grants...</div>
  }

  if (error) {
    return <div className="flex items-center justify-center h-32 text-sm text-destructive">{error}</div>
  }

  if (grants.length === 0) {
    return <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">No grants found</div>
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full border-collapse text-xs font-mono">
        <thead className="sticky top-0 z-10">
          <tr className="bg-[#1e1f23]">
            <th className="px-3 py-1.5 text-left font-medium border-b border-r border-border">Grantee</th>
            <th className="px-3 py-1.5 text-left font-medium border-b border-r border-border">Privilege</th>
            <th className="px-3 py-1.5 text-center font-medium border-b border-border">Grantable</th>
          </tr>
        </thead>
        <tbody>
          {grants.map((g, i) => (
            <tr key={`${g.grantee}-${g.privilege}`} className={cn('hover:bg-[#1e1f23]', i % 2 === 1 && 'bg-[#1a1b1e]/50')}>
              <td className="px-3 py-1 border-r border-border">{g.grantee}</td>
              <td className="px-3 py-1 border-r border-border text-muted-foreground">{g.privilege}</td>
              <td className="px-3 py-1 text-center">
                {g.grantable && <span className="text-green-400">Y</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
