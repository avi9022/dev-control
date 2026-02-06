import { useState, useEffect, useCallback, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { Power, PowerOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface TableTriggersTabProps {
  schema: string
  table: string
}

export const TableTriggersTab: FC<TableTriggersTabProps> = ({ schema, table }) => {
  const [triggers, setTriggers] = useState<SQLTriggerInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadTriggers = useCallback(() => {
    setLoading(true)
    setError(null)
    window.electron.sqlGetTableTriggers(schema, table)
      .then(setTriggers)
      .catch((err) => {
        setTriggers([])
        setError(err instanceof Error ? err.message : 'Failed to load triggers')
      })
      .finally(() => setLoading(false))
  }, [schema, table])

  useEffect(() => {
    loadTriggers()
  }, [loadTriggers])

  const handleToggle = async (triggerName: string, enable: boolean) => {
    try {
      await window.electron.sqlExecuteQuery(`ALTER TRIGGER "${schema}"."${triggerName}" ${enable ? 'ENABLE' : 'DISABLE'}`)
      toast.success(enable ? 'Enabled' : 'Disabled', { description: triggerName })
      loadTriggers()
    } catch (err) {
      toast.error('Failed', { description: err instanceof Error ? err.message : 'Operation failed' })
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">Loading triggers...</div>
  }

  if (error) {
    return <div className="flex items-center justify-center h-32 text-sm text-destructive">{error}</div>
  }

  if (triggers.length === 0) {
    return <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">No triggers found</div>
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full border-collapse text-xs font-mono">
        <thead className="sticky top-0 z-10">
          <tr className="bg-[#1e1f23]">
            <th className="px-3 py-1.5 text-left font-medium border-b border-r border-border">Name</th>
            <th className="px-3 py-1.5 text-left font-medium border-b border-r border-border">Status</th>
            <th className="px-3 py-1.5 text-left font-medium border-b border-r border-border">Event</th>
            <th className="px-3 py-1.5 text-left font-medium border-b border-r border-border">Table</th>
            <th className="w-20 px-3 py-1.5 text-center font-medium border-b border-border">Action</th>
          </tr>
        </thead>
        <tbody>
          {triggers.map((t, i) => (
            <tr key={t.name} className={cn('hover:bg-[#1e1f23]', i % 2 === 1 && 'bg-[#1a1b1e]/50')}>
              <td className="px-3 py-1 border-r border-border">{t.name}</td>
              <td className="px-3 py-1 border-r border-border">
                <span className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] font-medium',
                  t.status === 'ENABLED' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                )}>
                  {t.status}
                </span>
              </td>
              <td className="px-3 py-1 border-r border-border text-muted-foreground">{t.event}</td>
              <td className="px-3 py-1 border-r border-border text-muted-foreground">{t.table ?? ''}</td>
              <td className="px-3 py-1 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={() => handleToggle(t.name, t.status === 'DISABLED')}
                  title={t.status === 'ENABLED' ? 'Disable' : 'Enable'}
                >
                  {t.status === 'ENABLED'
                    ? <PowerOff className="h-3 w-3 text-red-400" />
                    : <Power className="h-3 w-3 text-green-400" />
                  }
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
