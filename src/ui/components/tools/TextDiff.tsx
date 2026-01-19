import { useState, useMemo, type FC } from 'react'
import { ToolLayout, InputArea } from './shared'
import { Button } from '@/components/ui/button'

type DiffType = 'added' | 'removed' | 'unchanged'

interface DiffLine {
  type: DiffType
  content: string
  lineNumber: { left?: number; right?: number }
}

function computeDiff(left: string, right: string): DiffLine[] {
  const leftLines = left.split('\n')
  const rightLines = right.split('\n')

  const lcs = longestCommonSubsequence(leftLines, rightLines)

  const result: DiffLine[] = []
  let leftIdx = 0
  let rightIdx = 0
  let lcsIdx = 0

  while (leftIdx < leftLines.length || rightIdx < rightLines.length) {
    if (lcsIdx < lcs.length && leftIdx < leftLines.length && leftLines[leftIdx] === lcs[lcsIdx] && rightIdx < rightLines.length && rightLines[rightIdx] === lcs[lcsIdx]) {
      result.push({
        type: 'unchanged',
        content: leftLines[leftIdx],
        lineNumber: { left: leftIdx + 1, right: rightIdx + 1 },
      })
      leftIdx++
      rightIdx++
      lcsIdx++
    } else {
      if (leftIdx < leftLines.length && (lcsIdx >= lcs.length || leftLines[leftIdx] !== lcs[lcsIdx])) {
        result.push({
          type: 'removed',
          content: leftLines[leftIdx],
          lineNumber: { left: leftIdx + 1 },
        })
        leftIdx++
      }
      if (rightIdx < rightLines.length && (lcsIdx >= lcs.length || rightLines[rightIdx] !== lcs[lcsIdx])) {
        result.push({
          type: 'added',
          content: rightLines[rightIdx],
          lineNumber: { right: rightIdx + 1 },
        })
        rightIdx++
      }
    }
  }

  return result
}

function longestCommonSubsequence(a: string[], b: string[]): string[] {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  const result: string[] = []
  let i = m
  let j = n
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1])
      i--
      j--
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }

  return result
}

export const TextDiff: FC = () => {
  const [left, setLeft] = useState('')
  const [right, setRight] = useState('')

  const diff = useMemo(() => {
    if (!left && !right) return []
    return computeDiff(left, right)
  }, [left, right])

  const stats = useMemo(() => {
    const added = diff.filter((d) => d.type === 'added').length
    const removed = diff.filter((d) => d.type === 'removed').length
    const unchanged = diff.filter((d) => d.type === 'unchanged').length
    return { added, removed, unchanged }
  }, [diff])

  const handleSwap = () => {
    setLeft(right)
    setRight(left)
  }

  return (
    <ToolLayout
      title="Text Diff"
      description="Compare two text blocks and see line-by-line differences"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <InputArea
            value={left}
            onChange={setLeft}
            label="Original Text"
            placeholder="Enter original text..."
            rows={8}
          />
          <InputArea
            value={right}
            onChange={setRight}
            label="Modified Text"
            placeholder="Enter modified text..."
            rows={8}
          />
        </div>

        <div className="flex justify-between items-center">
          <Button variant="outline" onClick={handleSwap}>
            Swap Left/Right
          </Button>
          {diff.length > 0 && (
            <div className="flex gap-4 text-sm">
              <span className="text-green-600">+{stats.added} added</span>
              <span className="text-red-600">-{stats.removed} removed</span>
              <span className="text-muted-foreground">{stats.unchanged} unchanged</span>
            </div>
          )}
        </div>

        {diff.length > 0 && (
          <div className="border rounded-md overflow-hidden">
            <div className="max-h-[400px] overflow-auto font-mono text-sm">
              {diff.map((line, i) => (
                <div
                  key={i}
                  className={`flex ${
                    line.type === 'added'
                      ? 'bg-green-500/10'
                      : line.type === 'removed'
                      ? 'bg-red-500/10'
                      : ''
                  }`}
                >
                  <div className="w-10 text-right px-2 py-0.5 text-muted-foreground border-r select-none">
                    {line.lineNumber.left || ''}
                  </div>
                  <div className="w-10 text-right px-2 py-0.5 text-muted-foreground border-r select-none">
                    {line.lineNumber.right || ''}
                  </div>
                  <div className="w-6 text-center py-0.5 border-r select-none">
                    {line.type === 'added' && <span className="text-green-600">+</span>}
                    {line.type === 'removed' && <span className="text-red-600">-</span>}
                  </div>
                  <div className="flex-1 px-2 py-0.5 whitespace-pre">
                    {line.content || ' '}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!left && !right && (
          <div className="text-center py-8 text-muted-foreground">
            Enter text in both panels to see the differences
          </div>
        )}
      </div>
    </ToolLayout>
  )
}
