import { useState, useEffect, type FC } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2 } from 'lucide-react'
import { ROLE_DEFINITIONS } from './pipeline-constants'

const COLOR_SWATCHES = [
  '#6B7FD7', '#4DA870', '#D4A843', '#9B6DC6',
  '#7C8894', '#D46B6B', '#6BBDD4', '#D4916B',
]

interface PhaseEditDialogProps {
  phase: AIPipelinePhase | null
  allPhases: AIPipelinePhase[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (id: string, updates: Partial<AIPipelinePhase>) => void
  onDelete: (id: string) => void
  themeClass: string
}

export const PhaseEditDialog: FC<PhaseEditDialogProps> = ({
  phase,
  allPhases,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
  themeClass,
}) => {
  const [localName, setLocalName] = useState('')
  const [localPrompt, setLocalPrompt] = useState('')
  const [localCustomTools, setLocalCustomTools] = useState('')
  const [localRejectPattern, setLocalRejectPattern] = useState('')

  useEffect(() => {
    if (phase) {
      setLocalName(phase.name)
      setLocalPrompt(phase.prompt || '')
      setLocalCustomTools(phase.customTools || '')
      setLocalRejectPattern(phase.rejectPattern || '')
    }
  }, [phase?.id])

  if (!phase) return null

  const commitName = () => {
    if (localName !== phase.name) onUpdate(phase.id, { name: localName })
  }
  const commitPrompt = () => {
    if (localPrompt !== (phase.prompt || '')) onUpdate(phase.id, { prompt: localPrompt })
  }
  const commitCustomTools = () => {
    onUpdate(phase.id, { customTools: localCustomTools || undefined })
  }
  const commitRejectPattern = () => {
    onUpdate(phase.id, { rejectPattern: localRejectPattern || undefined })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${themeClass} !max-w-[600px] max-h-[85vh] flex flex-col`} style={{ background: 'var(--ai-surface-1)', border: '1px solid var(--ai-border-subtle)', color: 'var(--ai-text-primary)' }}>
        <DialogHeader className="flex flex-row items-center justify-between pr-8">
          <DialogTitle className="text-lg font-semibold" style={{ color: 'var(--ai-text-primary)' }}>
            {phase.name}
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onDelete(phase.id)
              onOpenChange(false)
            }}
          >
            <Trash2 className="h-4 w-4" style={{ color: 'var(--ai-pink)' }} />
          </Button>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Name */}
          <div>
            <Label style={{ color: 'var(--ai-text-secondary)' }}>Name</Label>
            <Input
              value={localName}
              onChange={e => setLocalName(e.target.value)}
              onBlur={commitName}
              className="mt-1"
              style={{ background: 'var(--ai-surface-2)', borderColor: 'var(--ai-border-subtle)', color: 'var(--ai-text-primary)' }}
            />
          </div>

          {/* Type */}
          <div>
            <Label style={{ color: 'var(--ai-text-secondary)' }}>Type</Label>
            <Select value={phase.type} onValueChange={v => onUpdate(phase.id, { type: v as 'agent' | 'manual' })}>
              <SelectTrigger className="mt-1 w-40" style={{ background: 'var(--ai-surface-2)', borderColor: 'var(--ai-border-subtle)', color: 'var(--ai-text-primary)' }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Color Picker */}
          <div>
            <Label style={{ color: 'var(--ai-text-secondary)' }}>Color</Label>
            <div className="flex gap-2 mt-1.5">
              {COLOR_SWATCHES.map(color => (
                <button
                  key={color}
                  onClick={() => onUpdate(phase.id, { color })}
                  className="w-6 h-6 rounded-full transition-all shrink-0"
                  style={{
                    background: color,
                    outline: (phase.color || '#7C8894') === color ? `2px solid ${color}` : 'none',
                    outlineOffset: '2px',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Agent-only fields */}
          {phase.type === 'agent' && (
            <>
              {/* System Prompt */}
              <div>
                <Label style={{ color: 'var(--ai-text-secondary)' }}>System Prompt</Label>
                <Textarea
                  value={localPrompt}
                  onChange={e => setLocalPrompt(e.target.value)}
                  onBlur={commitPrompt}
                  placeholder="Instructions for the AI agent in this phase..."
                  rows={6}
                  className="mt-1 font-mono text-sm"
                  style={{ background: 'var(--ai-surface-2)', borderColor: 'var(--ai-border-subtle)', color: 'var(--ai-text-primary)' }}
                />
              </div>

              {/* Tool Roles */}
              <div>
                <Label style={{ color: 'var(--ai-text-secondary)' }}>Tool Roles</Label>
                <p className="text-xs mb-2" style={{ color: 'var(--ai-text-tertiary)' }}>
                  Select roles to control which tools the agent can use. No selection = all tools allowed.
                </p>
                <div className="space-y-2">
                  {ROLE_DEFINITIONS.map(role => {
                    const checked = phase.roles?.includes(role.id) ?? false
                    return (
                      <label key={role.id} className="flex items-start gap-2 cursor-pointer">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const current = phase.roles || []
                            const next = v ? [...current, role.id] : current.filter(r => r !== role.id)
                            onUpdate(phase.id, { roles: next.length > 0 ? next : undefined })
                          }}
                          className="mt-0.5"
                        />
                        <div>
                          <span className="text-sm" style={{ color: 'var(--ai-text-primary)' }}>{role.label}</span>
                          <p className="text-[10px]" style={{ color: 'var(--ai-text-tertiary)' }}>{role.tools}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>

                {/* Custom Tools */}
                <div className="mt-2">
                  <Label className="text-xs" style={{ color: 'var(--ai-text-secondary)' }}>
                    Custom Tools <span className="font-normal" style={{ color: 'var(--ai-text-tertiary)' }}>(optional)</span>
                  </Label>
                  <Input
                    value={localCustomTools}
                    onChange={e => setLocalCustomTools(e.target.value)}
                    onBlur={commitCustomTools}
                    placeholder="e.g. WebFetch, Agent, mcp__github__*"
                    className="mt-1 font-mono text-sm"
                    style={{ background: 'var(--ai-surface-2)', borderColor: 'var(--ai-border-subtle)', color: 'var(--ai-text-primary)' }}
                  />
                </div>
              </div>

              {/* Reject Pattern + Target */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label style={{ color: 'var(--ai-text-secondary)' }}>
                    Reject Pattern <span className="font-normal" style={{ color: 'var(--ai-text-tertiary)' }}>(optional)</span>
                  </Label>
                  <Input
                    value={localRejectPattern}
                    onChange={e => setLocalRejectPattern(e.target.value)}
                    onBlur={commitRejectPattern}
                    placeholder="e.g. REVIEW_DECISION: REJECT"
                    className="mt-1 font-mono text-sm"
                    style={{ background: 'var(--ai-surface-2)', borderColor: 'var(--ai-border-subtle)', color: 'var(--ai-text-primary)' }}
                  />
                </div>
                <div className="flex-1">
                  <Label style={{ color: 'var(--ai-text-secondary)' }}>Reject Target</Label>
                  <Select
                    value={phase.rejectTarget || ''}
                    onValueChange={v => onUpdate(phase.id, { rejectTarget: v || undefined })}
                  >
                    <SelectTrigger className="mt-1" style={{ background: 'var(--ai-surface-2)', borderColor: 'var(--ai-border-subtle)', color: 'var(--ai-text-primary)' }}>
                      <SelectValue placeholder="Select phase..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allPhases.filter(p => p.id !== phase.id).map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
