import { useState, type FC } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, Trash2, ChevronRight, ChevronDown } from 'lucide-react'
import { useApiClient } from '@/ui/contexts/api-client'
import { KeyValueTable } from './KeyValueTable'

interface EnvironmentManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const EnvironmentManager: FC<EnvironmentManagerProps> = ({ open, onOpenChange }) => {
  const { activeWorkspace, createEnvironment, updateEnvironment, deleteEnvironment, setActiveEnvironment } = useApiClient()
  const [newEnvName, setNewEnvName] = useState('')
  const [expandedEnvId, setExpandedEnvId] = useState<string | null>(null)
  const [editingNameId, setEditingNameId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const environments = activeWorkspace?.environments ?? []

  const handleCreate = async () => {
    const trimmed = newEnvName.trim()
    if (!trimmed) return
    await createEnvironment(trimmed)
    setNewEnvName('')
  }

  const handleDelete = async (envId: string) => {
    await deleteEnvironment(envId)
    if (expandedEnvId === envId) setExpandedEnvId(null)
  }

  const handleToggle = (envId: string) => {
    setExpandedEnvId(expandedEnvId === envId ? null : envId)
  }

  const handleStartRename = (env: ApiEnvironment) => {
    setEditingNameId(env.id)
    setEditingName(env.name)
  }

  const handleFinishRename = async (env: ApiEnvironment) => {
    const trimmed = editingName.trim()
    if (trimmed && trimmed !== env.name) {
      await updateEnvironment(env.id, { ...env, name: trimmed })
    }
    setEditingNameId(null)
  }

  const handleVariablesChange = async (env: ApiEnvironment, variables: ApiKeyValue[]) => {
    const apiVars: ApiVariable[] = variables.map((v) => ({
      key: v.key,
      value: v.value,
      type: 'default' as const,
      enabled: v.enabled,
    }))
    await updateEnvironment(env.id, { ...env, variables: apiVars })
  }

  const envVarsToKeyValues = (vars: ApiVariable[]): ApiKeyValue[] =>
    vars.map((v) => ({ key: v.key, value: v.value, enabled: v.enabled, description: '' }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Environments</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Input
            placeholder="New environment name..."
            value={newEnvName}
            onChange={(e) => setNewEnvName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
            className="h-8 text-sm"
          />
          <Button variant="outline" size="sm" onClick={handleCreate} disabled={!newEnvName.trim()}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="flex flex-col gap-2">
            {environments.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No environments yet</p>
            )}
            {environments.map((env) => {
              const isExpanded = expandedEnvId === env.id
              const isActive = env.id === activeWorkspace?.activeEnvironmentId

              return (
                <div key={env.id} className="border rounded-md">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <button onClick={() => handleToggle(env.id)} className="flex-shrink-0">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>

                    {editingNameId === env.id ? (
                      <Input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => handleFinishRename(env)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleFinishRename(env) }}
                        className="h-7 text-sm flex-1"
                      />
                    ) : (
                      <button
                        onClick={() => handleStartRename(env)}
                        className="text-sm font-medium flex-1 text-left truncate"
                      >
                        {env.name}
                      </button>
                    )}

                    <span className="text-xs text-muted-foreground">{env.variables.length} vars</span>

                    <Button
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setActiveEnvironment(isActive ? null : env.id)}
                    >
                      {isActive ? 'Active' : 'Set Active'}
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(env.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {isExpanded && (
                    <div className="px-3 pb-3 border-t">
                      <Label className="text-xs text-muted-foreground mt-2 mb-1 block">Variables</Label>
                      <KeyValueTable
                        items={envVarsToKeyValues(env.variables)}
                        onChange={(items) => handleVariablesChange(env, items)}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
