import { useState, useCallback, useMemo, type FC, type ReactNode } from 'react'
import { ChevronRight, ChevronDown, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface JsonViewerProps {
  data: unknown
  initialExpanded?: boolean
  maxInitialDepth?: number
  className?: string
}

interface JsonNodeProps {
  keyName?: string
  value: unknown
  depth: number
  isLast: boolean
  maxInitialDepth: number
  path: string
}

const copyToClipboard = (value: unknown) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  navigator.clipboard.writeText(text)
}

const getValuePreview = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `Array(${value.length})`
  }
  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value)
    return `{${keys.length} ${keys.length === 1 ? 'key' : 'keys'}}`
  }
  return ''
}

const JsonNode: FC<JsonNodeProps> = ({ keyName, value, depth, isLast, maxInitialDepth, path }) => {
  const [isExpanded, setIsExpanded] = useState(depth < maxInitialDepth)
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    copyToClipboard(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [value])

  const isObject = typeof value === 'object' && value !== null && !Array.isArray(value)
  const isArray = Array.isArray(value)
  const isExpandable = isObject || isArray

  const indent = depth * 16

  // Render primitive values
  if (!isExpandable) {
    return (
      <div
        className="group flex items-start hover:bg-muted/50 rounded px-1 -mx-1 min-w-0"
        style={{ paddingLeft: indent }}
      >
        <span className="flex flex-wrap items-baseline gap-1 py-0.5 min-w-0 max-w-full">
          {keyName !== undefined && (
            <>
              <span className="text-purple-400 font-medium flex-shrink-0">"{keyName}"</span>
              <span className="text-muted-foreground flex-shrink-0">:</span>
            </>
          )}
          <ValueRenderer value={value} />
          {!isLast && <span className="text-muted-foreground flex-shrink-0">,</span>}
        </span>
        <button
          onClick={handleCopy}
          className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded"
          title="Copy value"
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3 text-muted-foreground" />
          )}
        </button>
      </div>
    )
  }

  const entries = isArray
    ? value.map((v, i) => [i.toString(), v] as const)
    : Object.entries(value as Record<string, unknown>)

  const brackets = isArray ? ['[', ']'] : ['{', '}']

  return (
    <div>
      <div
        className="group flex items-start cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1"
        style={{ paddingLeft: indent }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="flex items-center py-0.5 select-none">
          <span className="w-4 h-4 flex items-center justify-center mr-0.5 text-muted-foreground">
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </span>
          {keyName !== undefined && (
            <>
              <span className="text-purple-400 font-medium">"{keyName}"</span>
              <span className="text-muted-foreground mx-1">:</span>
            </>
          )}
          <span className="text-muted-foreground">{brackets[0]}</span>
          {!isExpanded && (
            <>
              <span className="text-muted-foreground/60 mx-1 text-[10px]">
                {getValuePreview(value)}
              </span>
              <span className="text-muted-foreground">{brackets[1]}</span>
              {!isLast && <span className="text-muted-foreground">,</span>}
            </>
          )}
        </span>
        <button
          onClick={handleCopy}
          className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded"
          title="Copy object"
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3 text-muted-foreground" />
          )}
        </button>
      </div>

      {isExpanded && (
        <>
          {entries.map(([key, val], index) => (
            <JsonNode
              key={`${path}.${key}`}
              keyName={isArray ? undefined : key}
              value={val}
              depth={depth + 1}
              isLast={index === entries.length - 1}
              maxInitialDepth={maxInitialDepth}
              path={`${path}.${key}`}
            />
          ))}
          <div style={{ paddingLeft: indent }} className="py-0.5">
            <span className="text-muted-foreground">{brackets[1]}</span>
            {!isLast && <span className="text-muted-foreground">,</span>}
          </div>
        </>
      )}
    </div>
  )
}

const ValueRenderer: FC<{ value: unknown }> = ({ value }) => {
  if (value === null) {
    return <span className="text-orange-400 italic">null</span>
  }

  if (value === undefined) {
    return <span className="text-orange-400 italic">undefined</span>
  }

  if (typeof value === 'boolean') {
    return <span className="text-yellow-400">{value.toString()}</span>
  }

  if (typeof value === 'number') {
    return <span className="text-cyan-400">{value}</span>
  }

  if (typeof value === 'string') {
    // Check if it's a URL
    if (value.startsWith('http://') || value.startsWith('https://')) {
      const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        // Only open link with Cmd+Click (Mac) or Ctrl+Click (Windows/Linux)
        if (e.metaKey || e.ctrlKey) {
          window.open(value, '_blank', 'noopener,noreferrer')
        }
      }

      return (
        <span className="text-green-400 break-all">
          "<span
            onClick={handleClick}
            className="text-blue-400 hover:underline cursor-pointer"
            title="Cmd+Click to open link"
          >
            {value}
          </span>"
        </span>
      )
    }

    // Check if it's a date
    const dateMatch = value.match(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/)
    if (dateMatch) {
      return <span className="text-blue-400 break-all">"{value}"</span>
    }

    // Regular string
    return <span className="text-green-400 break-all">"{value}"</span>
  }

  return <span className="text-foreground">{String(value)}</span>
}

export const JsonViewer: FC<JsonViewerProps> = ({
  data,
  initialExpanded = true,
  maxInitialDepth = 3,
  className,
}) => {
  const parsedData = useMemo(() => {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data)
      } catch {
        return data
      }
    }
    return data
  }, [data])

  // If it's not valid JSON, just render as text
  if (typeof parsedData === 'string') {
    return (
      <pre className={cn("text-[11px] font-mono whitespace-pre-wrap break-all", className)}>
        {parsedData}
      </pre>
    )
  }

  return (
    <div className={cn("font-mono text-[11px] leading-relaxed min-w-0", className)}>
      <JsonNode
        value={parsedData}
        depth={0}
        isLast={true}
        maxInitialDepth={maxInitialDepth}
        path="root"
      />
    </div>
  )
}

// Toolbar for JSON viewer
interface JsonToolbarProps {
  onExpandAll: () => void
  onCollapseAll: () => void
  onCopy: () => void
  copied: boolean
}

export const JsonToolbar: FC<JsonToolbarProps> = ({
  onExpandAll,
  onCollapseAll,
  onCopy,
  copied,
}) => {
  return (
    <div className="flex items-center gap-1 text-[10px]">
      <button
        onClick={onExpandAll}
        className="px-2 py-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      >
        Expand All
      </button>
      <button
        onClick={onCollapseAll}
        className="px-2 py-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      >
        Collapse All
      </button>
      <button
        onClick={onCopy}
        className="px-2 py-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
      >
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
