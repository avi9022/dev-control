import { useState, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, Trash2, Eye, EyeOff, ChevronDown } from 'lucide-react'
import { useApiClient } from '@/ui/contexts/api-client'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export const VariablesPanel: FC = () => {
  const {
    activeWorkspace,
    updateEnvironment,
    createEnvironment,
    setActiveEnvironment,
  } = useApiClient()

  const [newVarKey, setNewVarKey] = useState('')
  const [newVarValue, setNewVarValue] = useState('')
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set())
  const [envDialogOpen, setEnvDialogOpen] = useState(false)
  const [envDialogValue, setEnvDialogValue] = useState('')

  const environments = activeWorkspace?.environments ?? []
  const activeEnv = environments.find((e) => e.id === activeWorkspace?.activeEnvironmentId)

  const handleAddVariable = async () => {
    if (!activeEnv || !newVarKey.trim()) return
    const newVar: ApiVariable = {
      key: newVarKey.trim(),
      value: newVarValue,
      type: 'default',
      enabled: true,
    }
    await updateEnvironment(activeEnv.id, {
      ...activeEnv,
      variables: [...activeEnv.variables, newVar],
    })
    setNewVarKey('')
    setNewVarValue('')
  }

  const handleUpdateVariable = async (index: number, field: 'key' | 'value', fieldValue: string) => {
    if (!activeEnv) return
    const updatedVars = activeEnv.variables.map((v, i) =>
      i === index ? { ...v, [field]: fieldValue } : v
    )
    await updateEnvironment(activeEnv.id, { ...activeEnv, variables: updatedVars })
  }

  const handleToggleType = async (index: number) => {
    if (!activeEnv) return
    const v = activeEnv.variables[index]
    const updatedVars = activeEnv.variables.map((variable, i) =>
      i === index ? { ...variable, type: v.type === 'secret' ? 'default' as const : 'secret' as const } : variable
    )
    await updateEnvironment(activeEnv.id, { ...activeEnv, variables: updatedVars })
  }

  const handleDeleteVariable = async (index: number) => {
    if (!activeEnv) return
    const updatedVars = activeEnv.variables.filter((_, i) => i !== index)
    await updateEnvironment(activeEnv.id, { ...activeEnv, variables: updatedVars })
  }

  const toggleReveal = (key: string) => {
    setRevealedSecrets((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
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

  return (
    <div className="h-full flex flex-col border-l bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">Variables</h3>
      </div>

      {/* Environment Selector */}
      <div className="px-4 py-2 border-b">
        {environments.length > 0 ? (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <select
                value={activeWorkspace?.activeEnvironmentId ?? ''}
                onChange={(e) => setActiveEnvironment(e.target.value || null)}
                className="w-full h-8 rounded-md border bg-background px-2 pr-8 text-sm appearance-none"
              >
                <option value="">No environment</option>
                {environments.map((env) => (
                  <option key={env.id} value={env.id}>{env.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={handleCreateEnv}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full" onClick={handleCreateEnv}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Environment
          </Button>
        )}
      </div>

      {/* Variables List */}
      {activeEnv ? (
        <>
          <div className="px-4 py-2 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold bg-emerald-600 text-white flex-shrink-0">
                E
              </span>
              <span className="text-sm font-medium truncate">{activeEnv.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">{activeEnv.variables.length} vars</span>
            </div>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="flex flex-col">
              {activeEnv.variables.map((variable, index) => {
                const isSecret = variable.type === 'secret'
                const isRevealed = revealedSecrets.has(variable.key)
                const displayValue = isSecret && !isRevealed
                  ? '•'.repeat(Math.min(variable.value.length, 20))
                  : variable.value

                return (
                  <div
                    key={`${variable.key}-${index}`}
                    className="group flex items-center gap-2 px-4 py-2 border-b hover:bg-muted/50"
                  >
                    <div className="flex-1 min-w-0">
                      <Input
                        value={variable.key}
                        onChange={(e) => handleUpdateVariable(index, 'key', e.target.value)}
                        className="h-7 text-sm font-mono font-medium border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        placeholder="VARIABLE_NAME"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Input
                        value={isSecret && !isRevealed ? displayValue : variable.value}
                        onChange={(e) => handleUpdateVariable(index, 'value', e.target.value)}
                        onFocus={() => { if (isSecret) setRevealedSecrets((p) => new Set(p).add(variable.key)) }}
                        onBlur={() => { if (isSecret) setRevealedSecrets((p) => { const n = new Set(p); n.delete(variable.key); return n }) }}
                        className="h-7 text-sm font-mono text-muted-foreground border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        placeholder="value"
                      />
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-6 w-6", isSecret && "text-amber-500")}
                        onClick={() => handleToggleType(index)}
                        title={isSecret ? 'Secret variable' : 'Make secret'}
                      >
                        {isSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteVariable(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}

              {/* Add new variable row */}
              <div className="flex items-center gap-2 px-4 py-2">
                <div className="flex-1 min-w-0">
                  <Input
                    value={newVarKey}
                    onChange={(e) => setNewVarKey(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddVariable() }}
                    className="h-7 text-sm font-mono border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    placeholder="Add variable..."
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <Input
                    value={newVarValue}
                    onChange={(e) => setNewVarValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddVariable() }}
                    className="h-7 text-sm font-mono text-muted-foreground border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    placeholder="value"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={handleAddVariable}
                  disabled={!newVarKey.trim()}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </ScrollArea>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground px-4">
          <p className="text-sm text-center">
            {environments.length === 0
              ? 'Create an environment to manage variables'
              : 'Select an environment to view variables'}
          </p>
        </div>
      )}

      {/* Environment Name Dialog */}
      <Dialog open={envDialogOpen} onOpenChange={setEnvDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Environment name</DialogTitle>
            <DialogDescription>Enter a name for the new environment.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Name..."
            value={envDialogValue}
            onChange={(e) => setEnvDialogValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateEnvConfirm()
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEnvDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateEnvConfirm} disabled={!envDialogValue.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
