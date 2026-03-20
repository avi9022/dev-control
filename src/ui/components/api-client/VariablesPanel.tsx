import { useState, useMemo, useEffect, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, Trash2, Eye, EyeOff, ChevronDown, ChevronRight, X, Sparkles } from 'lucide-react'
import { useApiClient } from '@/ui/contexts/api-client'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface VariablesPanelProps {
  requestData?: {
    url: string
    params: ApiKeyValue[]
    headers: ApiKeyValue[]
    body: ApiRequestBody
    auth: ApiAuth
  }
  requestId?: string
  collectionId?: string
  onClose?: () => void
}

// Extract all {{varName}} patterns from a string
const extractVariables = (text: string): string[] => {
  const matches = text.match(/\{\{([^}]+)\}\}/g)
  if (!matches) return []
  return matches.map(m => m.slice(2, -2))
}

// Extract variables from auth object
const extractAuthVariables = (auth?: ApiAuth): string[] => {
  if (!auth || auth.type === 'none' || auth.type === 'inherit') return []
  const authStr = JSON.stringify(auth)
  return extractVariables(authStr)
}

// Extract variables from request data (excluding auth which may be inherited)
const extractRequestVariablesWithoutAuth = (requestData?: VariablesPanelProps['requestData']): string[] => {
  if (!requestData) return []

  const vars = new Set<string>()

  // URL
  extractVariables(requestData.url).forEach(v => vars.add(v))

  // Params
  requestData.params.forEach(p => {
    extractVariables(p.key).forEach(v => vars.add(v))
    extractVariables(p.value).forEach(v => vars.add(v))
  })

  // Headers
  requestData.headers.forEach(h => {
    extractVariables(h.key).forEach(v => vars.add(v))
    extractVariables(h.value).forEach(v => vars.add(v))
  })

  // Body
  if (requestData.body.content) {
    extractVariables(requestData.body.content).forEach(v => vars.add(v))
  }
  if (requestData.body.formData) {
    requestData.body.formData.forEach(f => {
      extractVariables(f.key).forEach(v => vars.add(v))
      extractVariables(f.value).forEach(v => vars.add(v))
    })
  }

  return Array.from(vars)
}

export const VariablesPanel: FC<VariablesPanelProps> = ({ requestData, requestId, collectionId, onClose }) => {
  const {
    activeWorkspace,
    updateEnvironment,
    createEnvironment,
    setActiveEnvironment,
  } = useApiClient()

  const [newVarKey, setNewVarKey] = useState('')
  const [newVarValue, setNewVarValue] = useState('')
  const [revealedValues, setRevealedValues] = useState<Set<string>>(new Set())
  const [envDialogOpen, setEnvDialogOpen] = useState(false)
  const [envDialogValue, setEnvDialogValue] = useState('')
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<'key' | 'value' | null>(null)
  const [allVarsExpanded, setAllVarsExpanded] = useState(false)
  const [resolvedAuthInfo, setResolvedAuthInfo] = useState<ResolvedAuthInfo | null>(null)

  const environments = activeWorkspace?.environments ?? []
  const activeEnv = environments.find((e) => e.id === activeWorkspace?.activeEnvironmentId)

  // Fetch resolved auth when auth type is 'inherit'
  useEffect(() => {
    const fetchResolvedAuth = async () => {
      if (
        requestData?.auth?.type === 'inherit' &&
        requestId &&
        collectionId &&
        activeWorkspace
      ) {
        try {
          const resolved = await window.electron.apiGetResolvedAuth(
            activeWorkspace.id,
            collectionId,
            requestId
          )
          setResolvedAuthInfo(resolved)
        } catch {
          setResolvedAuthInfo(null)
        }
      } else {
        setResolvedAuthInfo(null)
      }
    }
    fetchResolvedAuth()
  }, [requestData?.auth?.type, requestId, collectionId, activeWorkspace])

  // Variables used in the current request (including inherited auth)
  const requestVarNames = useMemo(() => {
    const varsWithoutAuth = extractRequestVariablesWithoutAuth(requestData)

    // Get auth variables - either from request's own auth or inherited auth
    let authVars: string[] = []
    if (requestData?.auth?.type === 'inherit' && resolvedAuthInfo) {
      authVars = extractAuthVariables(resolvedAuthInfo.auth)
    } else if (requestData?.auth) {
      authVars = extractAuthVariables(requestData.auth)
    }

    return [...new Set([...varsWithoutAuth, ...authVars])]
  }, [requestData, resolvedAuthInfo])

  // Map of variable name to value from active environment
  const envVarMap = useMemo(() => {
    const map = new Map<string, string>()
    activeEnv?.variables.forEach(v => {
      if (v.enabled) map.set(v.key, v.value)
    })
    return map
  }, [activeEnv])

  // Variables in request (with their values)
  const requestVariables = useMemo(() => {
    return requestVarNames.map(name => ({
      name,
      value: envVarMap.get(name),
      resolved: envVarMap.has(name),
    }))
  }, [requestVarNames, envVarMap])

  // Other variables (not in request)
  const otherVariables = useMemo(() => {
    const requestSet = new Set(requestVarNames)
    return activeEnv?.variables.filter(v => !requestSet.has(v.key)) ?? []
  }, [activeEnv, requestVarNames])

  const handleUpdateVariable = async (varName: string, field: 'key' | 'value', fieldValue: string) => {
    if (!activeEnv) return
    const idx = activeEnv.variables.findIndex(v => v.key === varName)
    if (idx < 0) return
    const updatedVars = activeEnv.variables.map((v, i) =>
      i === idx ? { ...v, [field]: fieldValue } : v
    )
    await updateEnvironment(activeEnv.id, { ...activeEnv, variables: updatedVars })
  }

  const handleAddVariable = async (key: string, value: string) => {
    if (!activeEnv || !key.trim()) return
    const newVar: ApiVariable = {
      key: key.trim(),
      value: value,
      type: 'default',
      enabled: true,
    }
    await updateEnvironment(activeEnv.id, {
      ...activeEnv,
      variables: [...activeEnv.variables, newVar],
    })
  }

  const handleDeleteVariable = async (varName: string) => {
    if (!activeEnv) return
    const updatedVars = activeEnv.variables.filter(v => v.key !== varName)
    await updateEnvironment(activeEnv.id, { ...activeEnv, variables: updatedVars })
  }

  const handleCreateEnv = () => {
    setEnvDialogValue('')
    setEnvDialogOpen(true)
  }

  const handleCreateEnvConfirm = async () => {
    const trimmed = envDialogValue.trim()
    if (!trimmed) return
    await createEnvironment(trimmed)
    setEnvDialogOpen(false)
  }

  const toggleReveal = (key: string) => {
    setRevealedValues(prev => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }

  const VariableRow: FC<{
    varKey: string
    value: string | undefined
    resolved: boolean
    showActions?: boolean
  }> = ({ varKey, value, resolved, showActions = true }) => {
    const isRevealed = revealedValues.has(varKey)
    const isEditing = editingKey === varKey
    // Max 5 dots for hidden values
    const displayValue = value !== undefined
      ? (isRevealed ? value : '•••••')
      : undefined

    return (
      <div className="group grid grid-cols-[auto_1fr_minmax(60px,40%)_auto] items-center gap-2 px-3 py-2 border-b border-border/40 hover:bg-muted/30 transition-colors">
        {/* Environment badge */}
        <span className={cn(
          "inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold",
          resolved
            ? "bg-emerald-600 text-white"
            : "bg-status-red-bg text-status-red border border-status-red/30"
        )}>
          {resolved ? 'E' : '!'}
        </span>

        {/* Variable name */}
        <span className="font-mono text-[11px] font-medium truncate" title={varKey}>
          {varKey}
        </span>

        {/* Value */}
        <div className="flex items-center min-w-0">
          {isEditing && editingField === 'value' ? (
            <input
              autoFocus
              defaultValue={value ?? ''}
              onBlur={(e) => {
                handleUpdateVariable(varKey, 'value', e.target.value)
                setEditingKey(null)
                setEditingField(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleUpdateVariable(varKey, 'value', e.currentTarget.value)
                  setEditingKey(null)
                  setEditingField(null)
                }
                if (e.key === 'Escape') {
                  setEditingKey(null)
                  setEditingField(null)
                }
              }}
              className="w-full bg-muted/50 border border-primary rounded px-2 py-1 font-mono text-[11px] outline-none"
            />
          ) : resolved ? (
            <span
              onClick={() => {
                setEditingKey(varKey)
                setEditingField('value')
                setRevealedValues(prev => new Set(prev).add(varKey))
              }}
              className="font-mono text-[11px] text-muted-foreground truncate cursor-text hover:text-foreground transition-colors"
              title={isRevealed ? value : 'Click to edit'}
            >
              {displayValue || <span className="italic text-muted-foreground/50">empty</span>}
            </span>
          ) : (
            <button
              onClick={() => handleAddVariable(varKey, '')}
              className="text-[10px] text-primary hover:underline whitespace-nowrap"
            >
              + Add
            </button>
          )}
        </div>

        {/* Actions */}
        {showActions && resolved ? (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => toggleReveal(varKey)}
              className={cn(
                "p-1 rounded hover:bg-accent transition-colors",
                isRevealed && "text-amber-500"
              )}
              title={isRevealed ? 'Hide value' : 'Show value'}
            >
              {isRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </button>
            <button
              onClick={() => handleDeleteVariable(varKey)}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-destructive transition-colors"
              title="Delete variable"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div />
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b">
        <span className="text-sm font-semibold">Variables in request</span>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Environment Selector */}
      <div className="px-3 py-2 border-b flex items-center gap-2 bg-muted/20 min-w-0">
        <span className="text-[10px] text-muted-foreground flex-shrink-0">Env:</span>
        <div className="relative flex-1 min-w-0">
          <select
            value={activeWorkspace?.activeEnvironmentId ?? ''}
            onChange={(e) => setActiveEnvironment(e.target.value || null)}
            className="w-full h-6 rounded border bg-background px-1.5 pr-5 text-[11px] appearance-none cursor-pointer truncate"
          >
            <option value="">No environment</option>
            {environments.map((env) => (
              <option key={env.id} value={env.id}>{env.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-2.5 w-2.5 text-muted-foreground pointer-events-none" />
        </div>
        <button
          onClick={handleCreateEnv}
          className="h-6 w-6 flex-shrink-0 flex items-center justify-center rounded hover:bg-accent border"
          title="Create new environment"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {/* Inherited Auth Indicator */}
      {resolvedAuthInfo && (
        <div className="px-3 py-1.5 border-b bg-blue-500/10">
          <span className="text-[10px] text-blue-400 line-clamp-2">
            Auth from {resolvedAuthInfo.source}: <span className="font-medium">{resolvedAuthInfo.sourceName}</span>
          </span>
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0 overflow-x-hidden">
        {/* Request Variables Section */}
        {requestVariables.length > 0 ? (
          <div className="overflow-hidden">
            {requestVariables.map((v) => (
              <VariableRow
                key={v.name}
                varKey={v.name}
                value={v.value}
                resolved={v.resolved}
              />
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted/50 mb-3">
              <Sparkles className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <p className="text-[12px] text-muted-foreground">
              No variables in this request
            </p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">
              Use {'{{variableName}}'} syntax to add variables
            </p>
          </div>
        )}

        {/* All Variables Section (Collapsible) */}
        {activeEnv && otherVariables.length > 0 && (
          <div className="border-t overflow-hidden">
            <button
              onClick={() => setAllVarsExpanded(!allVarsExpanded)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors"
            >
              {allVarsExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              )}
              <span className="text-[11px] font-medium">All variables</span>
              <span className="text-[10px] text-muted-foreground">
                ({otherVariables.length})
              </span>
            </button>

            {allVarsExpanded && (
              <div className="border-t border-border/30 overflow-hidden">
                {otherVariables.map((v) => (
                  <VariableRow
                    key={v.key}
                    varKey={v.key}
                    value={v.value}
                    resolved={true}
                  />
                ))}

                {/* Add new variable */}
                <div className="flex items-center gap-2 px-3 py-2 border-t border-dashed border-border/50 overflow-hidden">
                  <span className="flex-shrink-0 w-5" />
                  <input
                    value={newVarKey}
                    onChange={(e) => setNewVarKey(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newVarKey.trim()) {
                        handleAddVariable(newVarKey, newVarValue)
                        setNewVarKey('')
                        setNewVarValue('')
                      }
                    }}
                    placeholder="Key"
                    className="flex-1 min-w-0 bg-transparent font-mono text-[11px] outline-none placeholder:text-muted-foreground/40"
                  />
                  <input
                    value={newVarValue}
                    onChange={(e) => setNewVarValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newVarKey.trim()) {
                        handleAddVariable(newVarKey, newVarValue)
                        setNewVarKey('')
                        setNewVarValue('')
                      }
                    }}
                    placeholder="Value"
                    className="flex-1 min-w-0 bg-transparent font-mono text-[11px] text-muted-foreground outline-none placeholder:text-muted-foreground/40"
                  />
                  <button
                    onClick={() => {
                      if (newVarKey.trim()) {
                        handleAddVariable(newVarKey, newVarValue)
                        setNewVarKey('')
                        setNewVarValue('')
                      }
                    }}
                    disabled={!newVarKey.trim()}
                    className="p-1 rounded hover:bg-accent disabled:opacity-30 transition-colors flex-shrink-0"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Show add variable when no env or empty */}
        {activeEnv && otherVariables.length === 0 && requestVariables.length > 0 && (
          <div className="border-t overflow-hidden">
            <button
              onClick={() => setAllVarsExpanded(!allVarsExpanded)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors"
            >
              {allVarsExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              )}
              <span className="text-[11px] font-medium">All variables</span>
            </button>

            {allVarsExpanded && (
              <div className="border-t border-border/30 px-3 py-2">
                <p className="text-[10px] text-muted-foreground mb-2">Add a new variable:</p>
                <div className="flex items-center gap-1.5">
                  <input
                    value={newVarKey}
                    onChange={(e) => setNewVarKey(e.target.value)}
                    placeholder="Key"
                    className="flex-1 min-w-0 h-6 px-1.5 rounded border bg-background font-mono text-[11px] outline-none"
                  />
                  <input
                    value={newVarValue}
                    onChange={(e) => setNewVarValue(e.target.value)}
                    placeholder="Value"
                    className="flex-1 min-w-0 h-6 px-1.5 rounded border bg-background font-mono text-[11px] outline-none"
                  />
                  <Button
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => {
                      if (newVarKey.trim()) {
                        handleAddVariable(newVarKey, newVarValue)
                        setNewVarKey('')
                        setNewVarValue('')
                      }
                    }}
                    disabled={!newVarKey.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* No environment warning */}
      {!activeEnv && (
        <div className="px-4 py-4 border-t bg-muted/20">
          <p className="text-[11px] text-muted-foreground text-center">
            Select or create an environment to manage variables
          </p>
        </div>
      )}

      {/* Create Environment Dialog */}
      <Dialog open={envDialogOpen} onOpenChange={setEnvDialogOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">New Environment</DialogTitle>
            <DialogDescription className="text-xs">Enter a name for the environment.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Environment name..."
            value={envDialogValue}
            onChange={(e) => setEnvDialogValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateEnvConfirm() }}
            className="h-8 text-sm"
          />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEnvDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreateEnvConfirm} disabled={!envDialogValue.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
