import { useState, useEffect, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'

interface TableDDLTabProps {
  schema: string
  table: string
}

export const TableDDLTab: FC<TableDDLTabProps> = ({ schema, table }) => {
  const [ddl, setDdl] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.electron.sqlGetObjectDDL(schema, table, 'TABLE')
      .then(setDdl)
      .catch((err) => {
        setDdl('')
        setError(err instanceof Error ? err.message : 'Failed to retrieve DDL')
      })
      .finally(() => setLoading(false))
  }, [schema, table])

  const handleCopy = () => {
    navigator.clipboard.writeText(ddl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">Loading DDL...</div>
  }

  if (error) {
    return <div className="flex items-center justify-center h-32 text-sm text-destructive">{error}</div>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-end px-3 py-1.5 border-b border-border">
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={handleCopy}
        >
          {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-3">
        <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">{ddl}</pre>
      </div>
    </div>
  )
}
