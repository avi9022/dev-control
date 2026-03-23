import { useState, useRef, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MentionEditor, type MentionEditorHandle } from './MentionEditor'
import { Send, FolderOpen, X, GitBranch, Eye, Lock } from 'lucide-react'
import { FIXED_PHASES, GIT_STRATEGY } from '@/shared/constants'

interface AmendmentFormProps {
  pipeline: AIPipelinePhase[]
  onSubmit: (text: string, targetPhase: string, newProjects?: AITaskProject[]) => Promise<void>
  onCancel?: () => void
  existingProjects?: AITaskProject[]
  existingWorktrees?: AITaskWorktree[]
  defaultPhase?: string
  defaultGitStrategy?: AIGitStrategy
  defaultBaseBranch?: string
  taskId?: string
  boardId?: string
}

export const AmendmentForm: FC<AmendmentFormProps> = ({
  pipeline, onSubmit, onCancel, existingProjects = [], existingWorktrees = [],
  defaultPhase, defaultGitStrategy, defaultBaseBranch, taskId, boardId
}) => {
  const editorRef = useRef<MentionEditorHandle>(null)
  const [targetPhase, setTargetPhase] = useState<string>(defaultPhase || pipeline[0]?.id || '')
  const [submitting, setSubmitting] = useState(false)
  const [taggedProjects, setTaggedProjects] = useState<DirectorySettings[]>([])
  const [projectConfigs, setProjectConfigs] = useState<Record<string, { gitStrategy: AIGitStrategy; branchName: string; baseBranch: string }>>({})

  const phases = pipeline.filter(p => p.id !== FIXED_PHASES.BACKLOG && p.id !== FIXED_PHASES.DONE)
  const worktreePaths = new Set(existingWorktrees.map(w => w.projectPath))

  const handleProjectTagged = (dir: DirectorySettings) => {
    if (taggedProjects.some(p => p.id === dir.id)) return
    setTaggedProjects(prev => [...prev, dir])
    // Only set config for projects without existing worktrees
    if (!worktreePaths.has(dir.path)) {
      setProjectConfigs(prev => ({
        ...prev,
        [dir.id]: {
          gitStrategy: defaultGitStrategy === GIT_STRATEGY.NONE ? GIT_STRATEGY.NONE : GIT_STRATEGY.WORKTREE,
          branchName: '',
          baseBranch: defaultBaseBranch ?? 'main'
        }
      }))
    }
  }

  const handleProjectRemoved = (label: string) => {
    const proj = taggedProjects.find(p => (p.customLabel || p.name) === label)
    if (!proj) return
    setTaggedProjects(prev => prev.filter(p => p.id !== proj.id))
    setProjectConfigs(prev => {
      const next = { ...prev }
      delete next[proj.id]
      return next
    })
  }

  const updateProjectConfig = (id: string, updates: Partial<{ gitStrategy: AIGitStrategy; branchName: string; baseBranch: string }>) => {
    setProjectConfigs(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates }
    }))
  }

  const handleSubmit = async () => {
    const text = editorRef.current?.getPlainText().trim()
    if (!text || !targetPhase) return
    setSubmitting(true)
    try {
      // Submit projects that don't have worktrees yet (new or existing without worktree)
      const newProjects: AITaskProject[] = taggedProjects
        .filter(p => !worktreePaths.has(p.path))
        .map(p => {
          const config = projectConfigs[p.id] || { gitStrategy: GIT_STRATEGY.WORKTREE, branchName: '', baseBranch: 'main' }
          return {
            path: p.path,
            label: p.customLabel || p.name,
            gitStrategy: config.gitStrategy,
            ...(config.gitStrategy === GIT_STRATEGY.WORKTREE ? {
              baseBranch: config.baseBranch.trim() || 'main',
              customBranchName: config.branchName.trim() || undefined
            } : {})
          }
        })
      await onSubmit(text, targetPhase, newProjects.length > 0 ? newProjects : undefined)
      editorRef.current?.clear()
      setTaggedProjects([])
      setProjectConfigs({})
    } finally {
      setSubmitting(false)
    }
  }

  // Combine existing tagged paths with newly tagged paths for dropdown exclusion
  const allExcludedPaths = new Set<string>()
  for (const p of taggedProjects) allExcludedPaths.add(p.path)

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--ai-text-tertiary)' }}>New Requirement</label>
        <MentionEditor
          ref={editorRef}
          placeholder="Describe the new requirement... Type @ to tag a project, # to reference a task"
          minHeight="80px"
          excludeProjectPaths={allExcludedPaths}
          onProjectTagged={handleProjectTagged}
          onProjectRemoved={handleProjectRemoved}
          boardId={boardId}
          excludeTaskIds={new Set(taskId ? [taskId] : [])}
        />
      </div>

      {/* Tagged project configs */}
      {taggedProjects.length > 0 && (
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--ai-text-tertiary)' }}>Projects</label>
          <div className="space-y-2">
            {taggedProjects.map(p => {
              const hasWorktree = worktreePaths.has(p.path)
              const existingProject = existingProjects.find(ep => ep.path === p.path)

              if (hasWorktree && existingProject) {
                // Show existing project as disabled card
                return (
                  <div
                    key={p.id}
                    className="rounded-md border p-2.5"
                    style={{ borderColor: 'var(--ai-border-subtle)', background: 'var(--ai-surface-2)', opacity: 0.7 }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--ai-text-tertiary)' }} />
                          <span className="text-sm truncate" style={{ color: 'var(--ai-text-secondary)' }}>{existingProject.label}</span>
                          <Lock className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--ai-text-tertiary)' }} />
                        </div>
                        <p className="text-[11px] truncate ml-5" style={{ color: 'var(--ai-text-tertiary)' }}>{p.path}</p>
                      </div>
                      <button onClick={() => handleProjectRemoved(p.customLabel || p.name)} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--ai-text-tertiary)' }}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 ml-5">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{
                          background: existingProject.gitStrategy === GIT_STRATEGY.WORKTREE ? 'var(--ai-accent-subtle)' : 'var(--ai-surface-3)',
                          color: existingProject.gitStrategy === GIT_STRATEGY.WORKTREE ? 'var(--ai-accent)' : 'var(--ai-text-tertiary)',
                        }}
                      >
                        {existingProject.gitStrategy === GIT_STRATEGY.WORKTREE ? 'worktree' : 'read only'}
                      </span>
                      {existingProject.baseBranch && (
                        <span className="text-[10px]" style={{ color: 'var(--ai-text-tertiary)' }}>
                          base: <span className="font-mono">{existingProject.baseBranch}</span>
                        </span>
                      )}
                      <span className="text-[10px] italic" style={{ color: 'var(--ai-text-tertiary)' }}>
                        already in task
                      </span>
                    </div>
                  </div>
                )
              }

              // New project — editable config
              const config = projectConfigs[p.id] || { gitStrategy: GIT_STRATEGY.WORKTREE, branchName: '', baseBranch: 'main' }
              return (
                <div key={p.id} className="rounded-md border p-2.5" style={{ borderColor: 'var(--ai-border-subtle)', background: 'var(--ai-surface-2)' }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--ai-accent)' }} />
                        <span className="text-sm truncate" style={{ color: 'var(--ai-accent)' }}>{p.customLabel || p.name}</span>
                      </div>
                      <p className="text-[11px] truncate ml-5" style={{ color: 'var(--ai-text-tertiary)' }}>{p.path}</p>
                    </div>
                    <button onClick={() => handleProjectRemoved(p.customLabel || p.name)} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--ai-text-tertiary)' }}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-end gap-2">
                      <div className="flex-shrink-0">
                        <span className="text-[10px] font-medium mb-1 block" style={{ color: 'var(--ai-text-tertiary)' }}>Strategy</span>
                        <Select value={config.gitStrategy} onValueChange={v => {
                          if (v === GIT_STRATEGY.WORKTREE || v === GIT_STRATEGY.NONE) updateProjectConfig(p.id, { gitStrategy: v })
                        }}>
                          <SelectTrigger className="h-7 w-[130px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={GIT_STRATEGY.WORKTREE}>
                              <span className="flex items-center gap-1"><GitBranch className="h-3 w-3" /> Worktree</span>
                            </SelectItem>
                            <SelectItem value={GIT_STRATEGY.NONE}>
                              <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> Read Only</span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {config.gitStrategy === GIT_STRATEGY.WORKTREE && (
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-medium mb-1 block" style={{ color: 'var(--ai-text-tertiary)' }}>Base Branch</span>
                          <Input
                            value={config.baseBranch}
                            onChange={e => updateProjectConfig(p.id, { baseBranch: e.target.value })}
                            placeholder="main"
                            className="h-7 text-xs"
                          />
                        </div>
                      )}
                      {config.gitStrategy === GIT_STRATEGY.NONE && (
                        <span className="text-[11px] italic" style={{ color: 'var(--ai-text-tertiary)' }}>Agent can read but not modify this project</span>
                      )}
                    </div>
                    {config.gitStrategy === GIT_STRATEGY.WORKTREE && (
                      <div>
                        <span className="text-[10px] font-medium mb-1 block" style={{ color: 'var(--ai-text-tertiary)' }}>Branch Name</span>
                        <Input
                          value={config.branchName}
                          onChange={e => updateProjectConfig(p.id, { branchName: e.target.value })}
                          placeholder="Auto-generated from task title"
                          className="h-7 text-xs"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--ai-text-tertiary)' }}>Send to Phase</label>
        <Select value={targetPhase} onValueChange={setTargetPhase}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select phase..." />
          </SelectTrigger>
          <SelectContent>
            {phases.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        )}
        <Button size="sm" onClick={handleSubmit} disabled={submitting}>
          <Send className="h-3 w-3 mr-1" />
          {submitting ? 'Submitting...' : 'Submit Amendment'}
        </Button>
      </div>
    </div>
  )
}
