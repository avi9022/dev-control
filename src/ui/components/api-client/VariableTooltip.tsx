import { useState, useCallback, useRef, type FC } from 'react'
import { cn } from '@/lib/utils'
import { useVariableMap } from './VariableHighlight'
import { VariableEditPopup } from './VariableEditPopup'

interface VariableTooltipProps {
  varName: string
  resolved: boolean
}

export const VariableTooltip: FC<VariableTooltipProps> = ({ varName, resolved }) => {
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  // Track if mouse is over variable or tooltip
  const isOverVariable = useRef(false)
  const isOverTooltip = useRef(false)
  const closeTimeout = useRef<NodeJS.Timeout | null>(null)

  const cancelClose = () => {
    if (closeTimeout.current) {
      clearTimeout(closeTimeout.current)
      closeTimeout.current = null
    }
  }

  const scheduleClose = () => {
    cancelClose()
    closeTimeout.current = setTimeout(() => {
      if (!isOverVariable.current && !isOverTooltip.current && !isEditing) {
        setHover(null)
        setIsEditing(false)
      }
    }, 150)
  }

  const handleVariableEnter = useCallback((e: React.MouseEvent) => {
    cancelClose()
    isOverVariable.current = true
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setHover({ x: rect.left, y: rect.bottom })
    setIsEditing(false)
  }, [])

  const handleVariableLeave = useCallback(() => {
    isOverVariable.current = false
    scheduleClose()
  }, [])

  const handleTooltipEnter = useCallback(() => {
    cancelClose()
    isOverTooltip.current = true
  }, [])

  const handleTooltipLeave = useCallback(() => {
    isOverTooltip.current = false
    if (!isEditing) {
      scheduleClose()
    }
  }, [isEditing])

  const handleClose = () => {
    setHover(null)
    setIsEditing(false)
    isOverVariable.current = false
    isOverTooltip.current = false
  }

  return (
    <>
      <span
        className={cn(
          "rounded px-0.5 italic pointer-events-auto cursor-default",
          resolved
            ? "text-sky-400 bg-sky-400/10"
            : "text-status-red bg-status-red/10",
        )}
        onMouseEnter={handleVariableEnter}
        onMouseLeave={handleVariableLeave}
      >
        {`{{${varName}}}`}
      </span>

      {hover && (
        <VariableEditPopup
          varName={varName}
          position={hover}
          onClose={handleClose}
          onMouseEnter={handleTooltipEnter}
          onMouseLeave={handleTooltipLeave}
        />
      )}
    </>
  )
}
