import { useState, useCallback, type FC } from 'react'
import { cn } from '@/lib/utils'

import { useVariableMap, parseTextSegments } from './variableUtils'

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
                  : "text-status-red bg-status-red/10",
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
                <span className="text-status-red">Variable not found in any environment</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
