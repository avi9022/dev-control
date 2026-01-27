import { useState, useCallback, type FC } from 'react'
import { useMongoDB } from '@/ui/contexts/mongodb'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  BarChart3,
  Inbox,
} from 'lucide-react'

interface SchemaViewProps {
  database: string
  collection: string
}

const TYPE_COLORS: Record<string, string> = {
  String: 'bg-green-500',
  Number: 'bg-blue-500',
  Boolean: 'bg-yellow-500',
  ObjectId: 'bg-purple-500',
  Date: 'bg-orange-500',
  Array: 'bg-cyan-500',
  Object: 'bg-pink-500',
  Null: 'bg-gray-400',
  Double: 'bg-blue-400',
  Int32: 'bg-blue-600',
  Long: 'bg-blue-700',
  Decimal128: 'bg-blue-300',
  Binary: 'bg-slate-500',
  RegExp: 'bg-red-400',
  Timestamp: 'bg-orange-400',
  Undefined: 'bg-gray-300',
}

const TYPE_TEXT_COLORS: Record<string, string> = {
  String: 'text-green-500',
  Number: 'text-blue-500',
  Boolean: 'text-yellow-500',
  ObjectId: 'text-purple-500',
  Date: 'text-orange-500',
  Array: 'text-cyan-500',
  Object: 'text-pink-500',
  Null: 'text-gray-400',
}

function getTypeColor(typeName: string): string {
  return TYPE_COLORS[typeName] ?? 'bg-gray-500'
}

function getTypeTextColor(typeName: string): string {
  return TYPE_TEXT_COLORS[typeName] ?? 'text-gray-500'
}

interface FieldRowProps {
  field: MongoSchemaField
  depth: number
}

const FieldRow: FC<FieldRowProps> = ({ field, depth }) => {
  const [expanded, setExpanded] = useState(false)
  const hasChildren = field.hasNestedFields && field.nestedFields && field.nestedFields.length > 0
  const probability = Math.round(field.probability * 100)

  return (
    <>
      <tr className="border-b border-border/50 hover:bg-muted/30 transition-colors">
        <td className="py-2 px-3">
          <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 16}px` }}>
            {hasChildren ? (
              <button
                className="p-0.5 hover:bg-muted rounded"
                onClick={() => setExpanded((prev) => !prev)}
              >
                {expanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            ) : (
              <span className="w-[22px]" />
            )}
            <span className="font-mono text-sm">{field.name}</span>
          </div>
        </td>
        <td className="py-2 px-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden flex">
              {field.types.map((t) => {
                const width = Math.max(t.probability * 100, 2)
                return (
                  <div
                    key={t.name}
                    className={`h-full ${getTypeColor(t.name)} transition-all`}
                    style={{ width: `${width}%` }}
                    title={`${t.name}: ${Math.round(t.probability * 100)}% (${t.count})`}
                  />
                )
              })}
            </div>
            <div className="flex flex-wrap gap-1 min-w-[120px]">
              {field.types.map((t) => (
                <span key={t.name} className={`text-xs font-mono ${getTypeTextColor(t.name)}`}>
                  {t.name}
                  {field.types.length > 1 && (
                    <span className="text-muted-foreground ml-0.5">
                      {Math.round(t.probability * 100)}%
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </td>
        <td className="py-2 px-3 text-right">
          <span className="text-sm text-muted-foreground">{probability}%</span>
        </td>
        <td className="py-2 px-3 text-right">
          <span className="text-sm text-muted-foreground">{field.count}</span>
        </td>
      </tr>
      {expanded &&
        hasChildren &&
        field.nestedFields?.map((nested) => (
          <FieldRow key={nested.path} field={nested} depth={depth + 1} />
        ))}
    </>
  )
}

export const SchemaView: FC<SchemaViewProps> = ({ database, collection }) => {
  const { analyzeSchema } = useMongoDB()
  const [fields, setFields] = useState<MongoSchemaField[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analyzed, setAnalyzed] = useState(false)

  const handleAnalyze = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await analyzeSchema(database, collection)
      const schemaFields = Array.isArray(result) ? result : (result as unknown as { fields: MongoSchemaField[] })?.fields ?? []
      setFields(schemaFields)
      setAnalyzed(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze schema')
    } finally {
      setLoading(false)
    }
  }, [database, collection, analyzeSchema])

  if (!analyzed && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
        <BarChart3 className="h-10 w-10" />
        <p className="text-sm">Analyze the collection to discover its schema</p>
        <Button onClick={handleAnalyze} className="gap-2">
          <BarChart3 className="h-4 w-4" />
          Analyze Schema
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Analyzing schema...</p>
        <p className="text-xs">Sampling documents from {database}.{collection}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
        <p className="text-sm text-red-500">{error}</p>
        <Button size="sm" variant="outline" onClick={handleAnalyze}>
          Retry
        </Button>
      </div>
    )
  }

  if (fields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
        <Inbox className="h-8 w-8" />
        <p className="text-sm">No schema fields found</p>
        <Button size="sm" variant="outline" onClick={handleAnalyze}>
          Re-analyze
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {fields.length} field{fields.length !== 1 ? 's' : ''}
          </Badge>
          {/* Type legend */}
          <div className="flex items-center gap-2 ml-2">
            {['String', 'Number', 'Boolean', 'ObjectId', 'Date', 'Array', 'Object', 'Null'].map((t) => (
              <div key={t} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${getTypeColor(t)}`} />
                <span className="text-[10px] text-muted-foreground">{t}</span>
              </div>
            ))}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={handleAnalyze} className="h-7 gap-1.5">
          <BarChart3 className="h-3.5 w-3.5" />
          Re-analyze
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-2 px-3 text-left font-medium w-[200px]">Field</th>
              <th className="py-2 px-3 text-left font-medium">Type Distribution</th>
              <th className="py-2 px-3 text-right font-medium w-[80px]">Probability</th>
              <th className="py-2 px-3 text-right font-medium w-[60px]">Count</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <FieldRow key={field.path} field={field} depth={0} />
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  )
}
