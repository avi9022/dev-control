import { useState, useRef, useCallback, useEffect, type FC } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAIAutomation } from '@/ui/contexts/ai-automation'
import { type MentionEditorHandle, MentionEditor } from './MentionEditor'
import { TaskForm } from './TaskForm'
import { GIT_STRATEGY } from '@/shared/constants'
import { ChevronLeft, ChevronRight, Plus, Trash2, Layers } from 'lucide-react'

const FALLBACK_BASE_BRANCH = 'main'
const SLIDE_ANIMATION_MS = 300
const DESCRIPTION_MIN_HEIGHT = '100px'

interface SubtaskState {
  title: string
  descriptionRef: React.RefObject<MentionEditorHandle | null>
}

interface ClusterPrefill {
  title: string
  subtasks: Array<{ title: string; description: string }>
  projectPaths?: string
  boardId?: string
  requestId: string
}

interface NewTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clusterPrefill?: ClusterPrefill
}

export const NewTaskDialog: FC<NewTaskDialogProps> = ({ open, onOpenChange, clusterPrefill }) => {
  const { createTask, createCluster, settings } = useAIAutomation()
  const [directories, setDirectories] = useState<DirectorySettings[]>([])
  const [isClusterMode, setIsClusterMode] = useState(!!clusterPrefill)
  const [title, setTitle] = useState(clusterPrefill?.title || '')
  const [taggedProjects, setTaggedProjects] = useState<DirectorySettings[]>([])
  const [projectConfigs, setProjectConfigs] = useState<Record<string, { gitStrategy: AIGitStrategy; branchName: string; baseBranch: string }>>({})
  const [pendingFiles, setPendingFiles] = useState<{ name: string; path: string }[]>([])
  const descriptionRef = useRef<MentionEditorHandle>(null)
  const [initialized, setInitialized] = useState(!clusterPrefill)

  const [subtasks, setSubtasks] = useState<SubtaskState[]>(
    clusterPrefill
      ? clusterPrefill.subtasks.map(s => ({ title: s.title, descriptionRef: { current: null } }))
      : [{ title: '', descriptionRef: { current: null } }]
  )
  const [currentSubtaskStep, setCurrentSubtaskStep] = useState(0)

  const defaultBaseBranch = settings?.defaultBaseBranch ?? FALLBACK_BASE_BRANCH

  useEffect(() => {
    if (clusterPrefill) {
      window.electron.getDirectories().then(dirs => setDirectories(dirs))
    }
  }, [clusterPrefill])

  useEffect(() => {
    if (!clusterPrefill || initialized) return

    if (clusterPrefill.projectPaths && directories) {
      const paths = clusterPrefill.projectPaths.split(',').map(p => p.trim()).filter(Boolean)
      const matched: DirectorySettings[] = []
      const configs: Record<string, { gitStrategy: AIGitStrategy; branchName: string; baseBranch: string }> = {}
      for (const projectPath of paths) {
        const dir = directories.find(d => d.path === projectPath)
        if (!dir) continue
        matched.push(dir)
        configs[dir.id] = {
          gitStrategy: GIT_STRATEGY.WORKTREE,
          branchName: '',
          baseBranch: defaultBaseBranch,
        }
      }
      setTaggedProjects(matched)
      setProjectConfigs(configs)
    }

    setTimeout(() => {
      clusterPrefill.subtasks.forEach((s, i) => {
        const ref = subtasks[i]?.descriptionRef?.current
        if (ref) ref.hydrateText(s.description, new Set())
      })
      setInitialized(true)
    }, 0)
  }, [clusterPrefill, initialized, directories, defaultBaseBranch, subtasks])

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
          baseBranch: defaultBaseBranch,
        }
      }
    })
  }, [settings?.defaultGitStrategy, defaultBaseBranch])

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

  const buildProjects = useCallback((): AITaskProject[] => {
    return taggedProjects.map(p => {
      const config = projectConfigs[p.id] || { gitStrategy: GIT_STRATEGY.WORKTREE, branchName: '', baseBranch: defaultBaseBranch }
      return {
        path: p.path,
        label: p.customLabel || p.name,
        gitStrategy: config.gitStrategy,
        ...(config.gitStrategy === GIT_STRATEGY.WORKTREE ? {
          baseBranch: config.baseBranch.trim() || defaultBaseBranch,
          customBranchName: config.branchName.trim() || undefined
        } : {})
      }
    })
  }, [taggedProjects, projectConfigs, defaultBaseBranch])

  const resetForm = useCallback((): void => {
    setTitle('')
    descriptionRef.current?.clear()
    setTaggedProjects([])
    setProjectConfigs({})
    setPendingFiles([])
    setSubtasks([{ title: '', descriptionRef: { current: null } }])
    setCurrentSubtaskStep(0)
  }, [])

  const handleCreate = async (): Promise<void> => {
    if (!title.trim()) return
    const projects = buildProjects()

    if (isClusterMode) {
      const subtaskDefs = subtasks.map(s => ({
        title: s.title.trim(),
        description: s.descriptionRef.current?.getPlainText().trim() || '',
      })).filter(s => s.title)

      if (subtaskDefs.length === 0) return

      if (clusterPrefill) {
        await window.electron.aiClusterCreationResult(clusterPrefill.requestId, {
          title: title.trim(),
          subtasks: subtaskDefs,
          projects,
        })
      } else {
        await createCluster(title.trim(), subtaskDefs, projects, settings?.activeBoardId)
      }
    } else {
      const description = descriptionRef.current?.getPlainText().trim() || ''
      const task = await createTask(title.trim(), description, projects, settings?.activeBoardId)
      if (pendingFiles.length > 0) {
        await window.electron.aiAttachTaskFiles(task.id, pendingFiles.map(f => f.path))
      }
    }

    resetForm()
    onOpenChange(false)
  }

  const handleAddSubtask = useCallback((): void => {
    setSubtasks(prev => [...prev, { title: '', descriptionRef: { current: null } }])
    setCurrentSubtaskStep(subtasks.length)
  }, [subtasks.length])

  const handleRemoveSubtask = useCallback((): void => {
    if (subtasks.length <= 1) return
    setSubtasks(prev => prev.filter((_, i) => i !== currentSubtaskStep))
    setCurrentSubtaskStep(prev => Math.min(prev, subtasks.length - 2))
  }, [subtasks.length, currentSubtaskStep])

  const handleSubtaskTitleChange = useCallback((index: number, newTitle: string): void => {
    setSubtasks(prev => prev.map((s, i) => i === index ? { ...s, title: newTitle } : s))
  }, [])

  const excludeProjectPaths = new Set(taggedProjects.map(p => p.path))

  const canCreate = isClusterMode
    ? title.trim() && subtasks.some(s => s.title.trim())
    : title.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[95vw] h-[85vh] flex flex-col" style={{ background: 'var(--ai-surface-0)', borderColor: 'var(--ai-border-subtle)' }}>
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle>{isClusterMode ? 'New Cluster' : 'New Task'}</DialogTitle>
            <button
              onClick={() => setIsClusterMode(prev => !prev)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors"
              style={{
                background: isClusterMode ? 'var(--ai-accent-subtle)' : 'var(--ai-surface-2)',
                color: isClusterMode ? 'var(--ai-accent)' : 'var(--ai-text-secondary)',
                border: `1px solid ${isClusterMode ? 'var(--ai-accent)' : 'var(--ai-border-subtle)'}`,
              }}
            >
              <Layers className="h-3 w-3" />
              Cluster
            </button>
          </div>
        </DialogHeader>

        {isClusterMode ? (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
            <div>
              <Label>Cluster Title</Label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Feature name"
                className="mt-1"
                autoFocus
              />
            </div>

            <div
              className="rounded-lg p-4"
              style={{ border: '1px solid var(--ai-border-subtle)', background: 'var(--ai-surface-1)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentSubtaskStep(prev => Math.max(0, prev - 1))}
                    disabled={currentSubtaskStep === 0}
                    className="p-1 rounded transition-colors disabled:opacity-30"
                    style={{ color: 'var(--ai-text-secondary)' }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <div className="flex items-center gap-1.5">
                    {subtasks.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentSubtaskStep(i)}
                        className="rounded-full transition-all"
                        style={{
                          width: 8,
                          height: 8,
                          background: i === currentSubtaskStep ? 'var(--ai-accent)' : 'var(--ai-surface-3)',
                          border: i === currentSubtaskStep ? '2px solid var(--ai-accent)' : '2px solid var(--ai-border)',
                        }}
                      />
                    ))}
                  </div>

                  <button
                    onClick={() => setCurrentSubtaskStep(prev => Math.min(subtasks.length - 1, prev + 1))}
                    disabled={currentSubtaskStep >= subtasks.length - 1}
                    className="p-1 rounded transition-colors disabled:opacity-30"
                    style={{ color: 'var(--ai-text-secondary)' }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  <span className="text-xs ml-1" style={{ color: 'var(--ai-text-tertiary)' }}>
                    Subtask {currentSubtaskStep + 1} of {subtasks.length}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-6 text-xs" onClick={handleAddSubtask}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                  {subtasks.length > 1 && (
                    <Button variant="outline" size="sm" className="h-6 text-xs" onClick={handleRemoveSubtask}>
                      <Trash2 className="h-3 w-3 mr-1" /> Remove
                    </Button>
                  )}
                </div>
              </div>

              <div className="overflow-hidden relative">
                <div
                  className="flex"
                  style={{
                    transition: `transform ${SLIDE_ANIMATION_MS}ms ease-in-out`,
                    transform: `translateX(-${currentSubtaskStep * 100}%)`,
                  }}
                >
                  {subtasks.map((subtask, i) => (
                    <div key={i} className="space-y-3" style={{ width: '100%', flexShrink: 0 }}>
                      <div>
                        <Label>Subtask Title</Label>
                        <Input
                          value={subtask.title}
                          onChange={e => handleSubtaskTitleChange(i, e.target.value)}
                          placeholder={`Subtask ${i + 1} title`}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <MentionEditor
                          ref={subtask.descriptionRef}
                          placeholder="Describe what this subtask needs to do..."
                          className="mt-1"
                          minHeight={DESCRIPTION_MIN_HEIGHT}
                          onProjectTagged={handleProjectTagged}
                          onProjectRemoved={(label) => {
                            const proj = taggedProjects.find(p => (p.customLabel || p.name) === label)
                            if (proj) handleProjectRemoved(proj.id)
                          }}
                          excludeProjectPaths={excludeProjectPaths}
                          boardId={settings?.activeBoardId}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <TaskForm
              title=""
              onTitleChange={() => {}}
              descriptionRef={{ current: null }}
              taggedProjects={taggedProjects}
              onProjectTagged={handleProjectTagged}
              onProjectRemoved={handleProjectRemoved}
              projectConfigs={projectConfigs}
              onProjectConfigChange={handleProjectConfigChange}
              pendingFiles={pendingFiles}
              onFilesChange={handleFilesChange}
              boardId={settings?.activeBoardId}
              defaultBaseBranch={defaultBaseBranch}
              hideTitle
              hideDescription
            />
          </div>
        ) : (
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
            defaultBaseBranch={defaultBaseBranch}
          />
        )}

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!canCreate}>
            {isClusterMode ? 'Create Cluster' : 'Create Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
