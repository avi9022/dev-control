import { useState, useCallback, type FC } from 'react'
import { useApiClient } from '@/ui/contexts/api-client'
import { cn } from '@/lib/utils'

export function useVariableMap(): { vars: Map<string, string>; envName: string | undefined } {
  const { activeWorkspace } = useApiClient()

  const vars = new Map<string, string>()
  if (activeWorkspace) {
    const activeEnv = activeWorkspace.environments.find(
      (e) => e.id === activeWorkspace.activeEnvironmentId
    )
    if (activeEnv) {
      for (const v of activeEnv.variables) {
        if (v.enabled) vars.set(v.key, v.value)
      }
    }
    for (const col of activeWorkspace.collections) {
      if (col.variables) {
        for (const v of col.variables) {
          if (v.enabled && !vars.has(v.key)) {
            vars.set(v.key, v.value)
          }
        }
      }
    }
  }

  const envName = activeWorkspace?.environments.find(
    (e) => e.id === activeWorkspace?.activeEnvironmentId
  )?.name

  return { vars, envName }
}

interface TextSegment {
  type: 'text' | 'variable'
  text: string
  varName?: string
  resolved?: boolean
}

export function parseTextSegments(text: string, vars: Map<string, string>): TextSegment[] {
  const segments: TextSegment[] = []
  let lastIndex = 0
  const regex = /\{\{([^}]+)\}\}/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', text: text.slice(lastIndex, match.index) })
    }
    const varName = match[1].trim()
    segments.push({
      type: 'variable',
      text: match[0],
      varName,
      resolved: vars.has(varName),
    })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', text: text.slice(lastIndex) })
  }

  return segments
}

export function textHasVariables(text: string): boolean {
  return /\{\{[^}]+\}\}/.test(text)
}

interface VariableTooltipState {
  varName: string
  x: number
  y: number
}

/**
 * Renders text with {{variables}} highlighted in color.
 * Orange = resolved, Red = unresolved.
 * Hover shows resolved value tooltip.
 */
export const VariableHighlightText: FC<{ text: string; className?: string }> = ({ text, className }) => {
  const { vars, envName } = useVariableMap()
  const [hoveredVar, setHoveredVar] = useState<VariableTooltipState | null>(null)

  const handleVarMouseEnter = useCallback((e: React.MouseEvent, varName: string) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setHoveredVar({ varName, x: rect.left, y: rect.bottom + 4 })
  }, [])

  const handleVarMouseLeave = useCallback(() => {
    setHoveredVar(null)
  }, [])

  const resolvedValue = hoveredVar ? vars.get(hoveredVar.varName) : undefined
  const segments = parseTextSegments(text, vars)

  return (
    <>
      <span className={className}>
        {segments.map((seg, i) => {
          if (seg.type === 'text') {
            return <span key={i}>{seg.text}</span>
          }
          return (
            <span
              key={i}
              className={cn(
                "rounded px-0.5 cursor-default",
                seg.resolved
                  ? "text-orange-400 bg-orange-400/10"
                  : "text-red-400 bg-red-400/10",
              )}
              onMouseEnter={(e) => handleVarMouseEnter(e, seg.varName!)}
              onMouseLeave={handleVarMouseLeave}
            >
              {seg.text}
            </span>
          )
        })}
      </span>

      {hoveredVar && (
        <div
          className="fixed z-50 rounded-lg border bg-popover shadow-lg p-3 min-w-[250px] max-w-[400px]"
          style={{ left: hoveredVar.x, top: hoveredVar.y }}
        >
          <div className="flex flex-col gap-2">
            <div className="rounded bg-muted px-3 py-2 font-mono text-sm truncate">
              {resolvedValue ?? <span className="text-muted-foreground italic">not defined</span>}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {resolvedValue !== undefined ? (
                <>
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold bg-emerald-600 text-white flex-shrink-0">
                    E
                  </span>
                  <span>{envName ?? 'Environment'}</span>
                </>
              ) : (
                <span className="text-red-400">Variable not found in any environment</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
