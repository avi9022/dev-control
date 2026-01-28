import { useRef, useCallback, type FC } from 'react'
import { cn } from '@/lib/utils'
import { useVariableMap, parseTextSegments, textHasVariables } from './VariableHighlight'
import { VariableTooltip } from './VariableTooltip'

interface VariableInputProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: React.KeyboardEvent) => void
  placeholder?: string
  className?: string
}

export const VariableInput: FC<VariableInputProps> = ({
  value,
  onChange,
  onKeyDown,
  placeholder,
  className,
}) => {
  const { vars } = useVariableMap()
  const inputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const hasVars = textHasVariables(value)
  const segments = parseTextSegments(value, vars)

  const handleScroll = useCallback(() => {
    if (inputRef.current && overlayRef.current) {
      overlayRef.current.scrollLeft = inputRef.current.scrollLeft
    }
  }, [])

  return (
    <div className={cn("relative flex-1", className)}>
      {/* Real input at the bottom layer */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onScroll={handleScroll}
        placeholder={placeholder}
        className={cn(
          "w-full h-9 rounded-md border border-input px-3 py-1 text-sm font-mono",
          "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          hasVars ? "text-transparent caret-foreground bg-transparent" : "bg-background",
        )}
      />

      {/* Colored overlay ON TOP - pointer-events-none passes clicks to input, variable spans opt back in */}
      {hasVars && (
        <div
          ref={overlayRef}
          aria-hidden
          className="absolute inset-0 h-9 rounded-md px-3 py-1 text-sm font-mono flex items-center overflow-hidden whitespace-nowrap pointer-events-none z-20"
        >
          {segments.map((seg, i) => {
            if (seg.type === 'text') {
              return <span key={i}>{seg.text}</span>
            }
            return (
              <VariableTooltip key={i} varName={seg.varName!} resolved={seg.resolved!} />
            )
          })}
        </div>
      )}
    </div>
  )
}
