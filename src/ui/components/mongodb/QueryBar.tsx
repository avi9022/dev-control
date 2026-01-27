import { useState, useCallback, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Search, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react'

interface QueryBarProps {
  options: MongoQueryOptions
  onChange: (options: MongoQueryOptions) => void
}

interface FieldError {
  filter?: string
  projection?: string
  sort?: string
}

function tryParseJson(value: string): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  if (!value.trim()) {
    return { ok: true, data: {} }
  }
  try {
    const parsed = JSON.parse(value)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ok: false, error: 'Must be a JSON object' }
    }
    return { ok: true, data: parsed }
  } catch {
    return { ok: false, error: 'Invalid JSON' }
  }
}

const DEFAULT_OPTIONS: MongoQueryOptions = {
  filter: {},
  limit: 50,
}

export const QueryBar: FC<QueryBarProps> = ({ options, onChange }) => {
  const [filterText, setFilterText] = useState(
    Object.keys(options.filter).length > 0 ? JSON.stringify(options.filter) : ''
  )
  const [projectionText, setProjectionText] = useState(
    options.projection ? JSON.stringify(options.projection) : ''
  )
  const [sortText, setSortText] = useState(
    options.sort ? JSON.stringify(options.sort) : ''
  )
  const [limitText, setLimitText] = useState(String(options.limit ?? 50))
  const [skipText, setSkipText] = useState(String(options.skip ?? 0))
  const [expanded, setExpanded] = useState(false)
  const [errors, setErrors] = useState<FieldError>({})

  const handleFind = useCallback(() => {
    const filterResult = tryParseJson(filterText)
    const projectionResult = tryParseJson(projectionText)
    const sortResult = tryParseJson(sortText)

    const newErrors: FieldError = {}
    if (!filterResult.ok) newErrors.filter = filterResult.error
    if (!projectionResult.ok) newErrors.projection = projectionResult.error
    if (!sortResult.ok) newErrors.sort = sortResult.error

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})

    const limit = Math.max(1, parseInt(limitText, 10) || 50)
    const skip = Math.max(0, parseInt(skipText, 10) || 0)

    const newOptions: MongoQueryOptions = {
      filter: filterResult.ok ? filterResult.data : {},
      limit,
      ...(skip > 0 ? { skip } : {}),
      ...(projectionResult.ok && Object.keys(projectionResult.data).length > 0
        ? { projection: projectionResult.data as Record<string, 0 | 1> }
        : {}),
      ...(sortResult.ok && Object.keys(sortResult.data).length > 0
        ? { sort: sortResult.data as Record<string, 1 | -1> }
        : {}),
    }

    onChange(newOptions)
  }, [filterText, projectionText, sortText, limitText, skipText, onChange])

  const handleReset = useCallback(() => {
    setFilterText('')
    setProjectionText('')
    setSortText('')
    setLimitText('50')
    setSkipText('0')
    setErrors({})
    onChange(DEFAULT_OPTIONS)
  }, [onChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleFind()
      }
    },
    [handleFind]
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-xs text-muted-foreground">Filter</Label>
          <Input
            placeholder='{ "field": "value" }'
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`font-mono text-sm h-8 ${errors.filter ? 'border-red-500' : ''}`}
          />
          {errors.filter && (
            <p className="text-xs text-red-500">{errors.filter}</p>
          )}
        </div>
        <div className="flex items-end gap-1 pb-0.5">
          <Button size="sm" onClick={handleFind} className="h-8 gap-1.5">
            <Search className="h-3.5 w-3.5" />
            Find
          </Button>
          <Button size="sm" variant="outline" onClick={handleReset} className="h-8 gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded((prev) => !prev)}
            className="h-8 gap-1"
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Options
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="grid grid-cols-3 gap-3 pt-1">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Project</Label>
            <Input
              placeholder='{ "name": 1, "email": 1 }'
              value={projectionText}
              onChange={(e) => setProjectionText(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`font-mono text-sm h-8 ${errors.projection ? 'border-red-500' : ''}`}
            />
            {errors.projection && (
              <p className="text-xs text-red-500">{errors.projection}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Sort</Label>
            <Input
              placeholder='{ "createdAt": -1 }'
              value={sortText}
              onChange={(e) => setSortText(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`font-mono text-sm h-8 ${errors.sort ? 'border-red-500' : ''}`}
            />
            {errors.sort && (
              <p className="text-xs text-red-500">{errors.sort}</p>
            )}
          </div>
          <div className="flex gap-2">
            <div className="space-y-1 flex-1">
              <Label className="text-xs text-muted-foreground">Limit</Label>
              <Input
                type="number"
                min={1}
                value={limitText}
                onChange={(e) => setLimitText(e.target.value)}
                onKeyDown={handleKeyDown}
                className="text-sm h-8"
              />
            </div>
            <div className="space-y-1 flex-1">
              <Label className="text-xs text-muted-foreground">Skip</Label>
              <Input
                type="number"
                min={0}
                value={skipText}
                onChange={(e) => setSkipText(e.target.value)}
                onKeyDown={handleKeyDown}
                className="text-sm h-8"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
