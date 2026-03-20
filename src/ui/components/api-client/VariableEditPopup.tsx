import { useState, useCallback, useRef, useEffect, type FC } from 'react'
import { useVariableMap } from './VariableHighlight'
import { useApiClient } from '@/ui/contexts/api-client'

interface VariableEditPopupProps {
  varName: string
  position: { x: number; y: number }
  onClose: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

export const VariableEditPopup: FC<VariableEditPopupProps> = ({
  varName,
  position,
  onClose,
  onMouseEnter,
  onMouseLeave,
}) => {
  const { vars, envName } = useVariableMap()
  const { activeWorkspace, updateEnvironment, createEnvironment, setActiveEnvironment } = useApiClient()

  const currentValue = vars.get(varName) ?? ''
  const [editValue, setEditValue] = useState(currentValue)
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedValueRef = useRef(currentValue)

  // Update editValue when currentValue changes (from external updates)
  useEffect(() => {
    setEditValue(currentValue)
    lastSavedValueRef.current = currentValue
  }, [currentValue])

  const saveValue = useCallback(async (valueToSave: string) => {
    if (!activeWorkspace || valueToSave === lastSavedValueRef.current) return

    setIsSaving(true)
    try {
      const activeEnv = activeWorkspace.environments.find(
        (e) => e.id === activeWorkspace.activeEnvironmentId
      )

      if (activeEnv) {
        const existingIdx = activeEnv.variables.findIndex((v) => v.key === varName)
        const updatedVars = existingIdx >= 0
          ? activeEnv.variables.map((v, i) =>
            i === existingIdx ? { ...v, value: valueToSave } : v
          )
          : [...activeEnv.variables, { key: varName, value: valueToSave, type: 'default' as const, enabled: true }]

        await updateEnvironment(activeEnv.id, { ...activeEnv, variables: updatedVars })
      } else if (activeWorkspace.environments.length > 0) {
        const env = activeWorkspace.environments[0]
        const updatedVars = [...env.variables, { key: varName, value: valueToSave, type: 'default' as const, enabled: true }]
        await updateEnvironment(env.id, { ...env, variables: updatedVars })
        await setActiveEnvironment(env.id)
      } else {
        await createEnvironment('Default')
      }

      lastSavedValueRef.current = valueToSave
    } finally {
      setIsSaving(false)
    }
  }, [activeWorkspace, varName, updateEnvironment, createEnvironment, setActiveEnvironment])

  // Debounced auto-save on change
  const handleChange = useCallback((newValue: string) => {
    setEditValue(newValue)

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Schedule save after 300ms of no typing
    saveTimeoutRef.current = setTimeout(() => {
      saveValue(newValue)
    }, 300)
  }, [saveValue])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const resolved = vars.has(varName)

  return (
    <div
      className="fixed z-50 pointer-events-auto"
      style={{ left: position.x, top: position.y }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Bridge area */}
      <div className="h-1" />

      <div className="rounded border bg-popover shadow-md p-2 min-w-[260px] max-w-[400px]">
        <div className="flex flex-col gap-1.5">
          {/* Editable value */}
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onClose()
              }
            }}
            placeholder="Enter value..."
            className="w-full rounded bg-muted px-2 py-1 font-mono text-xs border-0 outline-none focus:ring-1 focus:ring-ring"
          />

          {/* Environment info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              {resolved ? (
                <>
                  <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded text-[8px] font-bold bg-emerald-600 text-white flex-shrink-0">
                    E
                  </span>
                  <span>{envName ?? 'Environment'}</span>
                </>
              ) : (
                <span className="text-status-red">Not defined</span>
              )}
            </div>

            {isSaving && (
              <span className="text-[10px] text-muted-foreground">Saving...</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
