import { useRef, useCallback, type FC, type RefObject } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MentionEditor, type MentionEditorHandle } from './MentionEditor'
import { FolderOpen, X, Paperclip, GitBranch, Eye } from 'lucide-react'
import { GIT_STRATEGY } from '@/shared/constants'

const FALLBACK_BASE_BRANCH = 'main'
const DESCRIPTION_MIN_HEIGHT = '100px'

interface TaskFormProps {
  title: string
  onTitleChange: (title: string) => void
  descriptionRef: RefObject<MentionEditorHandle | null>
  taggedProjects: DirectorySettings[]
  onProjectTagged: (dir: DirectorySettings) => void
  onProjectRemoved: (id: string) => void
  projectConfigs: Record<string, { gitStrategy: AIGitStrategy; branchName: string; baseBranch: string }>
  onProjectConfigChange: (id: string, updates: Partial<{ gitStrategy: AIGitStrategy; branchName: string; baseBranch: string }>) => void
  pendingFiles: { name: string; path: string }[]
  onFilesChange: (files: { name: string; path: string }[]) => void
  boardId?: string
  autoFocusTitle?: boolean
  defaultBaseBranch?: string
}

export const TaskForm: FC<TaskFormProps> = ({
  title,
  onTitleChange,
  descriptionRef,
  taggedProjects,
  onProjectTagged,
  onProjectRemoved,
  projectConfigs,
  onProjectConfigChange,
  pendingFiles,
  onFilesChange,
  boardId,
  autoFocusTitle,
  defaultBaseBranch = FALLBACK_BASE_BRANCH,
}) => {
  const titleRef = useRef<HTMLInputElement>(null)

  const excludeProjectPaths = new Set(taggedProjects.map(p => p.path))

  const handleProjectTaggedInternal = useCallback((dir: DirectorySettings) => {
    onProjectTagged(dir)
  }, [onProjectTagged])

  const handleProjectRemovedInternal = useCallback((label: string) => {
    const proj = taggedProjects.find(p => (p.customLabel || p.name) === label)
    if (proj) onProjectRemoved(proj.id)
  }, [taggedProjects, onProjectRemoved])

  const handleRemoveTaggedProject = useCallback((id: string) => {
    onProjectRemoved(id)
  }, [onProjectRemoved])

  const handleAddFiles = useCallback(async () => {
    const selected = await window.electron.aiSelectFiles()
    if (selected) {
      const newFiles = selected
        .filter(p => !pendingFiles.some(f => f.path === p))
        .map(p => ({ name: p.split('/').pop() || p, path: p }))
      onFilesChange([...pendingFiles, ...newFiles])
    }
  }, [pendingFiles, onFilesChange])

  const handleRemoveFile = useCallback((index: number) => {
    onFilesChange(pendingFiles.filter((_, j) => j !== index))
  }, [pendingFiles, onFilesChange])

  return (
    <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-1">
      <div>
        <Label>Title</Label>
        <Input
          ref={titleRef}
          value={title}
          onChange={e => onTitleChange(e.target.value)}
          placeholder="Task title"
          className="mt-1"
          autoFocus={autoFocusTitle}
        />
      </div>
      <div>
        <Label>Description</Label>
        <MentionEditor
          ref={descriptionRef}
          placeholder="Describe what needs to be done... Type @ to tag a project, # to reference a task"
          className="mt-1"
          minHeight={DESCRIPTION_MIN_HEIGHT}
          onProjectTagged={handleProjectTaggedInternal}
          onProjectRemoved={handleProjectRemovedInternal}
          excludeProjectPaths={excludeProjectPaths}
          boardId={boardId}
        />
      </div>
      {taggedProjects.length > 0 && (
        <div>
          <Label className="text-xs" style={{ color: 'var(--ai-text-tertiary)' }}>Project Workspaces</Label>
          <p className="text-[11px] mt-0.5 mb-1.5" style={{ color: 'var(--ai-text-tertiary)' }}>
            Projects set to &quot;Worktree&quot; get an isolated git branch for changes. &quot;Read Only&quot; projects can be referenced but not modified.
          </p>
          <div className="space-y-2">
            {taggedProjects.map(p => {
              const config = projectConfigs[p.id] || { gitStrategy: GIT_STRATEGY.WORKTREE, branchName: '', baseBranch: defaultBaseBranch }
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
                    <button onClick={() => handleRemoveTaggedProject(p.id)} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--ai-text-tertiary)' }}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-end gap-2">
                      <div className="flex-shrink-0">
                        <span className="text-[10px] font-medium mb-1 block" style={{ color: 'var(--ai-text-tertiary)' }}>Strategy</span>
                        <Select value={config.gitStrategy} onValueChange={v => {
                          if (v === GIT_STRATEGY.WORKTREE || v === GIT_STRATEGY.NONE) {
                            onProjectConfigChange(p.id, { gitStrategy: v })
                          }
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
                            onChange={e => onProjectConfigChange(p.id, { baseBranch: e.target.value })}
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
                          onChange={e => onProjectConfigChange(p.id, { branchName: e.target.value })}
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
        <Label>Attachments <span className="font-normal" style={{ color: 'var(--ai-text-tertiary)' }}>(optional)</span></Label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {pendingFiles.map((f, i) => (
            <span
              key={f.path}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs"
              style={{ background: 'var(--ai-surface-2)', borderColor: 'var(--ai-border-subtle)', color: 'var(--ai-text-secondary)' }}
            >
              <Paperclip className="h-3 w-3" style={{ color: 'var(--ai-text-tertiary)' }} />
              {f.name}
              <button onClick={() => handleRemoveFile(i)} style={{ color: 'var(--ai-pink)' }}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs"
            onClick={handleAddFiles}
          >
            <Paperclip className="h-3 w-3 mr-1" /> Add Files
          </Button>
        </div>
      </div>
    </div>
  )
}
