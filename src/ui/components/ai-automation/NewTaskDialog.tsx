import { useState, useRef, useCallback, type FC } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAIAutomation } from '@/ui/contexts/ai-automation'
import { type MentionEditorHandle } from './MentionEditor'
import { TaskForm } from './TaskForm'
import { GIT_STRATEGY } from '@/shared/constants'

const DEFAULT_BASE_BRANCH = 'main'

interface NewTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const NewTaskDialog: FC<NewTaskDialogProps> = ({ open, onOpenChange }) => {
  const { createTask, settings } = useAIAutomation()
  const [title, setTitle] = useState('')
  const [taggedProjects, setTaggedProjects] = useState<DirectorySettings[]>([])
  const [projectConfigs, setProjectConfigs] = useState<Record<string, { gitStrategy: AIGitStrategy; branchName: string; baseBranch: string }>>({})
  const [pendingFiles, setPendingFiles] = useState<{ name: string; path: string }[]>([])
  const descriptionRef = useRef<MentionEditorHandle>(null)

  const handleProjectTagged = useCallback((dir: DirectorySettings) => {
    setTaggedProjects(prev => {
      if (prev.some(p => p.id === dir.id)) return prev
      return [...prev, dir]
    })
    setProjectConfigs(prev => {
      if (prev[dir.id]) return prev
      return {
        ...prev,
        [dir.id]: {
          gitStrategy: settings?.defaultGitStrategy === GIT_STRATEGY.NONE ? GIT_STRATEGY.NONE : GIT_STRATEGY.WORKTREE,
          branchName: '',
          baseBranch: settings?.defaultBaseBranch ?? DEFAULT_BASE_BRANCH
        }
      }
    })
  }, [settings?.defaultGitStrategy, settings?.defaultBaseBranch])

  const handleProjectRemoved = useCallback((id: string) => {
    setTaggedProjects(prev => prev.filter(p => p.id !== id))
    setProjectConfigs(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const handleProjectConfigChange = useCallback((id: string, updates: Partial<{ gitStrategy: AIGitStrategy; branchName: string; baseBranch: string }>) => {
    setProjectConfigs(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates }
    }))
  }, [])

  const handleFilesChange = useCallback((files: { name: string; path: string }[]) => {
    setPendingFiles(files)
  }, [])

  const handleCreate = async () => {
    if (!title.trim()) return
    const description = descriptionRef.current?.getPlainText().trim() || ''
    const projects: AITaskProject[] = taggedProjects.map(p => {
      const config = projectConfigs[p.id] || { gitStrategy: GIT_STRATEGY.WORKTREE, branchName: '', baseBranch: DEFAULT_BASE_BRANCH }
      return {
        path: p.path,
        label: p.customLabel || p.name,
        gitStrategy: config.gitStrategy,
        ...(config.gitStrategy === GIT_STRATEGY.WORKTREE ? {
          baseBranch: config.baseBranch.trim() || DEFAULT_BASE_BRANCH,
          customBranchName: config.branchName.trim() || undefined
        } : {})
      }
    })
    const task = await createTask(title.trim(), description, projects, settings?.activeBoardId)
    if (pendingFiles.length > 0) {
      await window.electron.aiAttachTaskFiles(task.id, pendingFiles.map(f => f.path))
    }
    setTitle('')
    descriptionRef.current?.clear()
    setTaggedProjects([])
    setProjectConfigs({})
    setPendingFiles([])
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[95vw] h-[85vh] flex flex-col" style={{ background: 'var(--ai-surface-0)', borderColor: 'var(--ai-border-subtle)' }}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        <TaskForm
          title={title}
          onTitleChange={setTitle}
          descriptionRef={descriptionRef}
          taggedProjects={taggedProjects}
          onProjectTagged={handleProjectTagged}
          onProjectRemoved={handleProjectRemoved}
          projectConfigs={projectConfigs}
          onProjectConfigChange={handleProjectConfigChange}
          pendingFiles={pendingFiles}
          onFilesChange={handleFilesChange}
          boardId={settings?.activeBoardId}
          autoFocusTitle
          defaultBaseBranch={settings?.defaultBaseBranch}
        />
        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!title.trim()}>Create Task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
