import { useRef, useCallback, type FC } from 'react'
import { cn } from '@/lib/utils'
import { useVariableMap, parseTextSegments, textHasVariables } from './VariableHighlight'
import { VariableTooltip } from './VariableTooltip'

interface VariableTextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export const VariableTextarea: FC<VariableTextareaProps> = ({
  value,
  onChange,
  placeholder,
  className,
}) => {
  const { vars } = useVariableMap()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const hasVars = textHasVariables(value)

  const handleScroll = useCallback(() => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }, [])

  const lines = value.split('\n')

  return (
    <div className={cn("relative", className)}>
      {/* Real textarea at the bottom layer */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        placeholder={placeholder}
        className={cn(
          "w-full h-full rounded-md border border-input px-3 py-2 text-sm font-mono",
          "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          hasVars ? "text-transparent caret-foreground bg-transparent" : "bg-background",
        )}
      />

      {/* Colored overlay ON TOP */}
      {hasVars && (
        <div
          ref={overlayRef}
          aria-hidden
          className="absolute inset-0 rounded-md px-3 py-2 text-sm font-mono overflow-hidden pointer-events-none z-20 whitespace-pre-wrap break-words"
        >
          {lines.map((line, lineIdx) => {
            const segments = parseTextSegments(line, vars)
            return (
              <div key={lineIdx}>
                {segments.length === 0 ? '\u200B' : segments.map((seg, i) => {
                  if (seg.type === 'text') {
                    return <span key={i}>{seg.text}</span>
                  }
                  return (
                    <VariableTooltip key={i} varName={seg.varName!} resolved={seg.resolved!} />
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
