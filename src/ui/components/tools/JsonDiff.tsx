import { useState, useMemo, type FC } from 'react'
import { ToolLayout, InputArea } from './shared'
import { Button } from '@/components/ui/button'
import { Plus, Minus, Equal } from 'lucide-react'

type DiffType = 'added' | 'removed' | 'changed' | 'unchanged'

interface DiffResult {
  path: string
  type: DiffType
  oldValue?: unknown
  newValue?: unknown
}

function getType(val: unknown): string {
  if (val === null) return 'null'
  if (Array.isArray(val)) return 'array'
  return typeof val
}

function compareJson(obj1: unknown, obj2: unknown, path = ''): DiffResult[] {
  const results: DiffResult[] = []

  const type1 = getType(obj1)
  const type2 = getType(obj2)

  if (type1 !== type2) {
    results.push({ path: path || 'root', type: 'changed', oldValue: obj1, newValue: obj2 })
    return results
  }

  if (type1 === 'object' && obj1 !== null && obj2 !== null) {
    const o1 = obj1 as Record<string, unknown>
    const o2 = obj2 as Record<string, unknown>
    const allKeys = new Set([...Object.keys(o1), ...Object.keys(o2)])

    for (const key of allKeys) {
      const newPath = path ? `${path}.${key}` : key
      if (!(key in o1)) {
        results.push({ path: newPath, type: 'added', newValue: o2[key] })
      } else if (!(key in o2)) {
        results.push({ path: newPath, type: 'removed', oldValue: o1[key] })
      } else {
        results.push(...compareJson(o1[key], o2[key], newPath))
      }
    }
  } else if (type1 === 'array') {
    const a1 = obj1 as unknown[]
    const a2 = obj2 as unknown[]
    const maxLen = Math.max(a1.length, a2.length)

    for (let i = 0; i < maxLen; i++) {
      const newPath = `${path}[${i}]`
      if (i >= a1.length) {
        results.push({ path: newPath, type: 'added', newValue: a2[i] })
      } else if (i >= a2.length) {
        results.push({ path: newPath, type: 'removed', oldValue: a1[i] })
      } else {
        results.push(...compareJson(a1[i], a2[i], newPath))
      }
    }
  } else if (obj1 !== obj2) {
    results.push({ path: path || 'root', type: 'changed', oldValue: obj1, newValue: obj2 })
  }

  return results
}

const DiffLine: FC<{ diff: DiffResult }> = ({ diff }) => {
  const iconClass = 'h-4 w-4 mr-2'
  const formatValue = (val: unknown) => JSON.stringify(val)

  switch (diff.type) {
    case 'added':
      return (
        <div className="flex items-start py-1 px-2 bg-status-green-bg text-green-600 rounded text-sm font-mono">
          <Plus className={iconClass} />
          <span className="font-semibold">{diff.path}:</span>
          <span className="ml-2">{formatValue(diff.newValue)}</span>
        </div>
      )
    case 'removed':
      return (
        <div className="flex items-start py-1 px-2 bg-status-red-bg text-red-600 rounded text-sm font-mono">
          <Minus className={iconClass} />
          <span className="font-semibold">{diff.path}:</span>
          <span className="ml-2">{formatValue(diff.oldValue)}</span>
        </div>
      )
    case 'changed':
      return (
        <div className="py-1 px-2 bg-status-yellow-bg rounded text-sm font-mono space-y-1">
          <div className="flex items-start text-red-600">
            <Minus className={iconClass} />
            <span className="font-semibold">{diff.path}:</span>
            <span className="ml-2">{formatValue(diff.oldValue)}</span>
          </div>
          <div className="flex items-start text-green-600">
            <Plus className={iconClass} />
            <span className="font-semibold">{diff.path}:</span>
            <span className="ml-2">{formatValue(diff.newValue)}</span>
          </div>
        </div>
      )
    default:
      return null
  }
}

export const JsonDiff: FC = () => {
  const [left, setLeft] = useState('')
  const [right, setRight] = useState('')
  const [error, setError] = useState('')

  const diffs = useMemo(() => {
    if (!left.trim() || !right.trim()) return []

    try {
      setError('')
      const obj1 = JSON.parse(left)
      const obj2 = JSON.parse(right)
      return compareJson(obj1, obj2)
    } catch (e) {
      setError(`Invalid JSON: ${e instanceof Error ? e.message : 'Parse error'}`)
      return []
    }
  }, [left, right])

  const handleSwap = () => {
    setLeft(right)
    setRight(left)
  }

  return (
    <ToolLayout
      title="JSON Diff"
      description="Compare two JSON objects and highlight differences"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <InputArea
            value={left}
            onChange={setLeft}
            label="Original JSON"
            placeholder='{"key": "value"}'
            rows={8}
          />
          <InputArea
            value={right}
            onChange={setRight}
            label="Modified JSON"
            placeholder='{"key": "new value"}'
            rows={8}
          />
        </div>

        <div className="flex justify-center">
          <Button variant="outline" onClick={handleSwap}>
            Swap Left/Right
          </Button>
        </div>

        {error && (
          <div className="text-destructive text-sm p-3 bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        {!error && diffs.length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold">Differences ({diffs.length})</h3>
            </div>
            <div className="space-y-1 max-h-[300px] overflow-auto p-2 border rounded-md">
              {diffs.map((diff, i) => (
                <DiffLine key={i} diff={diff} />
              ))}
            </div>
          </div>
        )}

        {!error && left.trim() && right.trim() && diffs.length === 0 && (
          <div className="flex items-center gap-2 text-green-600 text-sm p-3 bg-status-green-bg rounded-md">
            <Equal className="h-4 w-4" />
            JSON objects are identical
          </div>
        )}
      </div>
    </ToolLayout>
  )
}
