import { useState, useCallback, type FC } from 'react'
import { cn } from '@/lib/utils'
import { useVariableMap } from './VariableHighlight'
import { useApiClient } from '@/ui/contexts/api-client'

interface VariableTooltipProps {
  varName: string
  resolved: boolean
}

export const VariableTooltip: FC<VariableTooltipProps> = ({ varName, resolved }) => {
  const { vars, envName } = useVariableMap()
  const { activeWorkspace, updateEnvironment, createEnvironment, setActiveEnvironment } = useApiClient()
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  const currentValue = vars.get(varName)

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setHover({ x: rect.left, y: rect.bottom + 4 })
    setEditValue(currentValue ?? '')
    setIsEditing(false)
  }, [currentValue])

  const handleMouseLeave = useCallback(() => {
    if (!isEditing) {
      setHover(null)
    }
  }, [isEditing])

  const handleSave = useCallback(async () => {
    if (!activeWorkspace) return

    const activeEnv = activeWorkspace.environments.find(
      (e) => e.id === activeWorkspace.activeEnvironmentId
    )

    if (activeEnv) {
      // Update existing variable or add new one
      const existingIdx = activeEnv.variables.findIndex((v) => v.key === varName)
      const updatedVars = existingIdx >= 0
        ? activeEnv.variables.map((v, i) =>
          i === existingIdx ? { ...v, value: editValue } : v
        )
        : [...activeEnv.variables, { key: varName, value: editValue, type: 'default' as const, enabled: true }]

      await updateEnvironment(activeEnv.id, { ...activeEnv, variables: updatedVars })
    } else if (activeWorkspace.environments.length > 0) {
      // No active env but environments exist - use first one
      const env = activeWorkspace.environments[0]
      const updatedVars = [...env.variables, { key: varName, value: editValue, type: 'default' as const, enabled: true }]
      await updateEnvironment(env.id, { ...env, variables: updatedVars })
      await setActiveEnvironment(env.id)
    } else {
      // No environments at all - create one
      await createEnvironment('Default')
      // After creation, we'd need to add the variable - this is a simplification
    }

    setIsEditing(false)
    setHover(null)
  }, [activeWorkspace, varName, editValue, updateEnvironment, createEnvironment, setActiveEnvironment])

  return (
    <>
      <span
        className={cn(
          "rounded px-0.5 font-semibold pointer-events-auto cursor-default",
          resolved
            ? "text-orange-400 bg-orange-400/10"
            : "text-red-400 bg-red-400/10",
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {`{{${varName}}}`}
      </span>

      {hover && (
        <div
          className="fixed z-50 rounded-lg border bg-popover shadow-lg p-3 min-w-[280px] max-w-[400px] pointer-events-auto"
          style={{ left: hover.x, top: hover.y }}
          onMouseEnter={() => setHover(hover)}
          onMouseLeave={() => { setHover(null); setIsEditing(false) }}
        >
          <div className="flex flex-col gap-2">
            {/* Editable value */}
            <input
              type="text"
              value={editValue}
              onChange={(e) => { setEditValue(e.target.value); setIsEditing(true) }}
              onFocus={() => setIsEditing(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
                if (e.key === 'Escape') { setHover(null); setIsEditing(false) }
              }}
              placeholder="Enter value..."
              className="w-full rounded bg-muted px-3 py-2 font-mono text-sm border-0 outline-none focus:ring-1 focus:ring-ring"
            />

            {/* Environment info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {resolved ? (
                  <>
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold bg-emerald-600 text-white flex-shrink-0">
                      E
                    </span>
                    <span>{envName ?? 'Environment'}</span>
                  </>
                ) : (
                  <span className="text-red-400">Not defined</span>
                )}
              </div>

              {isEditing && (
                <button
                  onClick={handleSave}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Save
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
