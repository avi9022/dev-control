import { useState, useCallback, type FC } from 'react'
import { useMongoDB } from '@/ui/contexts/mongodb'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Trash2,
  Play,
  RotateCcw,
  Loader2,
  ArrowDown,
  Inbox,
} from 'lucide-react'

interface AggregationBuilderProps {
  database: string
  collection: string
}

interface PipelineStage {
  id: string
  operator: string
  definition: string
  enabled: boolean
}

const STAGE_TYPES = [
  '$match',
  '$group',
  '$sort',
  '$project',
  '$lookup',
  '$unwind',
  '$limit',
  '$skip',
  '$count',
  '$addFields',
  '$set',
  '$unset',
  '$replaceRoot',
  '$out',
  '$merge',
] as const

const STAGE_TEMPLATES: Record<string, string> = {
  '$match': '{\n  "field": "value"\n}',
  '$group': '{\n  "_id": "$field",\n  "count": { "$sum": 1 }\n}',
  '$sort': '{\n  "field": 1\n}',
  '$project': '{\n  "field": 1,\n  "_id": 0\n}',
  '$lookup': '{\n  "from": "collection",\n  "localField": "field",\n  "foreignField": "_id",\n  "as": "joined"\n}',
  '$unwind': '{\n  "path": "$field",\n  "preserveNullAndEmptyArrays": false\n}',
  '$limit': '10',
  '$skip': '0',
  '$count': '"total"',
  '$addFields': '{\n  "newField": "expression"\n}',
  '$set': '{\n  "field": "expression"\n}',
  '$unset': '"fieldToRemove"',
  '$replaceRoot': '{\n  "newRoot": "$field"\n}',
  '$out': '"outputCollection"',
  '$merge': '{\n  "into": "collection"\n}',
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function tryParseStageValue(operator: string, definition: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(definition)
    return { ok: true, value: { [operator]: parsed } }
  } catch {
    return { ok: false, error: `Invalid JSON in ${operator} stage` }
  }
}

export const AggregationBuilder: FC<AggregationBuilderProps> = ({ database, collection }) => {
  const { runAggregation } = useMongoDB()

  const [stages, setStages] = useState<PipelineStage[]>([])
  const [addStageType, setAddStageType] = useState<string>('$match')
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null)
  const [executionTime, setExecutionTime] = useState<number | null>(null)
  const [stageCount, setStageCount] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAddStage = useCallback(() => {
    const newStage: PipelineStage = {
      id: generateId(),
      operator: addStageType,
      definition: STAGE_TEMPLATES[addStageType] ?? '{}',
      enabled: true,
    }
    setStages((prev) => [...prev, newStage])
  }, [addStageType])

  const handleRemoveStage = useCallback((id: string) => {
    setStages((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const handleUpdateDefinition = useCallback((id: string, definition: string) => {
    setStages((prev) =>
      prev.map((s) => (s.id === id ? { ...s, definition } : s))
    )
  }, [])

  const handleToggleEnabled = useCallback((id: string) => {
    setStages((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    )
  }, [])

  const handleRun = useCallback(async () => {
    const enabledStages = stages.filter((s) => s.enabled)
    if (enabledStages.length === 0) {
      setError('No enabled stages in pipeline')
      return
    }

    const pipeline: MongoAggregationStage[] = []
    for (const stage of enabledStages) {
      const parsed = tryParseStageValue(stage.operator, stage.definition)
      if (!parsed.ok) {
        setError(parsed.error)
        return
      }
      pipeline.push({
        id: stage.id,
        operator: stage.operator,
        definition: parsed.value[stage.operator] as Record<string, unknown>,
        enabled: true,
      })
    }

    setRunning(true)
    setError(null)
    try {
      const result = await runAggregation(database, collection, pipeline)
      if (Array.isArray(result)) {
        setResults(result)
        setExecutionTime(null)
        setStageCount(enabledStages.length)
      } else {
        const aggResult = result as unknown as MongoAggregationResult
        setResults(aggResult.documents ?? [])
        setExecutionTime(aggResult.executionTime ?? null)
        setStageCount(aggResult.stages ?? enabledStages.length)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aggregation failed')
      setResults(null)
    } finally {
      setRunning(false)
    }
  }, [stages, database, collection, runAggregation])

  const handleClear = useCallback(() => {
    setStages([])
    setResults(null)
    setError(null)
    setExecutionTime(null)
    setStageCount(null)
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {stages.length} stage{stages.length !== 1 ? 's' : ''}
          </Badge>
          {stages.filter((s) => !s.enabled).length > 0 && (
            <Badge variant="outline" className="text-xs">
              {stages.filter((s) => !s.enabled).length} disabled
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5"
            onClick={handleClear}
            disabled={stages.length === 0}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear
          </Button>
          <Button
            size="sm"
            className="h-7 gap-1.5"
            onClick={handleRun}
            disabled={running || stages.filter((s) => s.enabled).length === 0}
          >
            {running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Run Pipeline
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-1">
          {/* Pipeline Stages */}
          {stages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Inbox className="h-8 w-8" />
              <p className="text-sm">No stages in pipeline</p>
              <p className="text-xs">Add a stage to get started</p>
            </div>
          ) : (
            stages.map((stage, index) => (
              <div key={stage.id}>
                {/* Stage card */}
                <div
                  className={`border rounded-md ${
                    stage.enabled ? 'bg-card' : 'bg-muted/30 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2 px-3 py-2 border-b">
                    <Checkbox
                      checked={stage.enabled}
                      onCheckedChange={() => handleToggleEnabled(stage.id)}
                    />
                    <Badge variant="secondary" className="font-mono text-xs">
                      {stage.operator}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex-1">
                      Stage {index + 1}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => handleRemoveStage(stage.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="p-3">
                    <Textarea
                      className="font-mono text-xs min-h-[80px] resize-y"
                      value={stage.definition}
                      onChange={(e) => handleUpdateDefinition(stage.id, e.target.value)}
                      disabled={!stage.enabled}
                    />
                  </div>
                </div>
                {/* Arrow connector */}
                {index < stages.length - 1 && (
                  <div className="flex justify-center py-1">
                    <ArrowDown className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))
          )}

          {/* Add stage controls */}
          <div className="flex items-center gap-2 pt-3">
            <Select value={addStageType} onValueChange={setAddStageType}>
              <SelectTrigger className="w-[180px] h-8 text-sm font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGE_TYPES.map((type) => (
                  <SelectItem key={type} value={type} className="font-mono text-sm">
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={handleAddStage}>
              <Plus className="h-3.5 w-3.5" />
              Add Stage
            </Button>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {/* Results */}
          {results !== null && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium">Results</h3>
                <Badge variant="secondary" className="text-xs">
                  {results.length} document{results.length !== 1 ? 's' : ''}
                </Badge>
                {stageCount !== null && (
                  <Badge variant="outline" className="text-xs">
                    {stageCount} stage{stageCount !== 1 ? 's' : ''}
                  </Badge>
                )}
                {executionTime !== null && (
                  <Badge variant="outline" className="text-xs">
                    {executionTime}ms
                  </Badge>
                )}
              </div>
              {results.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <p className="text-sm">No results returned</p>
                </div>
              ) : (
                <div className="border rounded-md bg-muted/30">
                  <pre className="text-xs font-mono p-3 whitespace-pre-wrap break-all">
                    {JSON.stringify(results, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
