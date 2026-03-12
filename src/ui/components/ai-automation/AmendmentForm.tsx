import { useState, useRef, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MentionEditor, type MentionEditorHandle } from './MentionEditor'
import { Send, FolderOpen, X, GitBranch, Eye } from 'lucide-react'

interface AmendmentFormProps {
  pipeline: AIPipelinePhase[]
  onSubmit: (text: string, targetPhase: string, newProjects?: AITaskProject[]) => Promise<void>
  onCancel?: () => void
  excludeProjectPaths?: Set<string>
  defaultPhase?: string
  defaultGitStrategy?: AIGitStrategy
  defaultBaseBranch?: string
}

export const AmendmentForm: FC<AmendmentFormProps> = ({
  pipeline, onSubmit, onCancel, excludeProjectPaths,
  defaultPhase, defaultGitStrategy, defaultBaseBranch
}) => {
  const editorRef = useRef<MentionEditorHandle>(null)
  const [targetPhase, setTargetPhase] = useState<string>(defaultPhase || pipeline[0]?.id || '')
  const [submitting, setSubmitting] = useState(false)
  const [taggedProjects, setTaggedProjects] = useState<DirectorySettings[]>([])
  const [projectConfigs, setProjectConfigs] = useState<Record<string, { gitStrategy: AIGitStrategy; branchName: string; baseBranch: string }>>({})

  const phases = pipeline.filter(p => p.id !== 'BACKLOG' && p.id !== 'DONE')

  const handleProjectTagged = (dir: DirectorySettings) => {
    if (taggedProjects.some(p => p.id === dir.id)) return
    setTaggedProjects(prev => [...prev, dir])
    setProjectConfigs(prev => ({
      ...prev,
      [dir.id]: {
        gitStrategy: defaultGitStrategy === 'none' ? 'none' : 'worktree',
        branchName: '',
        baseBranch: defaultBaseBranch ?? 'main'
      }
    }))
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
      const newProjects: AITaskProject[] = taggedProjects.map(p => {
        const config = projectConfigs[p.id] || { gitStrategy: 'worktree', branchName: '', baseBranch: 'main' }
        return {
          path: p.path,
          label: p.customLabel || p.name,
          gitStrategy: config.gitStrategy,
          ...(config.gitStrategy === 'worktree' ? {
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

  // Combine existing excluded paths with newly tagged paths
  const allExcludedPaths = new Set(excludeProjectPaths)
  for (const p of taggedProjects) allExcludedPaths.add(p.path)

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--ai-text-tertiary)' }}>New Requirement</label>
        <MentionEditor
          ref={editorRef}
          placeholder="Describe the new requirement... Type @ to tag a project"
          minHeight="80px"
          excludeProjectPaths={allExcludedPaths}
          onProjectTagged={handleProjectTagged}
          onProjectRemoved={handleProjectRemoved}
        />
      </div>

      {/* Tagged project configs */}
      {taggedProjects.length > 0 && (
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--ai-text-tertiary)' }}>New Projects</label>
          <p className="text-[11px] mb-1.5" style={{ color: 'var(--ai-text-tertiary)' }}>
            Configure workspace settings for tagged projects.
          </p>
          <div className="space-y-2">
            {taggedProjects.map(p => {
              const config = projectConfigs[p.id] || { gitStrategy: 'worktree', branchName: '', baseBranch: 'main' }
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
                        <Select value={config.gitStrategy} onValueChange={v => updateProjectConfig(p.id, { gitStrategy: v as AIGitStrategy })}>
                          <SelectTrigger className="h-7 w-[130px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="worktree">
                              <span className="flex items-center gap-1"><GitBranch className="h-3 w-3" /> Worktree</span>
                            </SelectItem>
                            <SelectItem value="none">
                              <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> Read Only</span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {config.gitStrategy === 'worktree' && (
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
                      {config.gitStrategy === 'none' && (
                        <span className="text-[11px] italic" style={{ color: 'var(--ai-text-tertiary)' }}>Agent can read but not modify this project</span>
                      )}
                    </div>
                    {config.gitStrategy === 'worktree' && (
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
