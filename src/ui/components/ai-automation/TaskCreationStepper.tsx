import { useState, useRef, useCallback, useEffect, type FC } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { type MentionEditorHandle } from './MentionEditor'
import { TaskForm } from './TaskForm'
import { useAIAutomation } from '@/ui/contexts/ai-automation'
import { GIT_STRATEGY } from '@/shared/constants'

const FALLBACK_BASE_BRANCH = 'main'

const SLIDE_ANIMATION_MS = 300

interface TaskFormState {
  title: string
  taggedProjects: DirectorySettings[]
  projectConfigs: Record<string, { gitStrategy: AIGitStrategy; branchName: string; baseBranch: string }>
  pendingFiles: { name: string; path: string }[]
  approved: boolean
}

interface TaskCreationStepperProps {
  request: TaskStepperRequest
  onComplete: () => void
}

function buildInitialTaskStates(tasks: TaskStepperProposedTask[], directories: DirectorySettings[], baseBranchDefault: string): TaskFormState[] {
  return tasks.map(task => {
    const taggedProjects: DirectorySettings[] = []
    const projectConfigs: Record<string, { gitStrategy: AIGitStrategy; branchName: string; baseBranch: string }> = {}

    if (task.projectPaths) {
      const paths = task.projectPaths.split(',').map(p => p.trim()).filter(Boolean)
      for (const projectPath of paths) {
        const dir = directories.find(d => d.path === projectPath)
        if (!dir) continue
        taggedProjects.push(dir)
        projectConfigs[dir.id] = {
          gitStrategy: GIT_STRATEGY.WORKTREE,
          branchName: '',
          baseBranch: baseBranchDefault,
        }
      }
    }

    return {
      title: task.title,
      taggedProjects,
      projectConfigs,
      pendingFiles: [],
      approved: false,
    }
  })
}

export const TaskCreationStepper: FC<TaskCreationStepperProps> = ({ request, onComplete }) => {
  const { settings } = useAIAutomation()
  const defaultBaseBranch = settings?.defaultBaseBranch || FALLBACK_BASE_BRANCH
  const [taskStates, setTaskStates] = useState<TaskFormState[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [initialized, setInitialized] = useState(false)
  const descRefs = useRef<React.RefObject<MentionEditorHandle | null>[]>([])

  useEffect(() => {
    let cancelled = false
    window.electron.getDirectories().then(directories => {
      if (cancelled) return
      const states = buildInitialTaskStates(request.tasks, directories, defaultBaseBranch)
      descRefs.current = request.tasks.map(() => ({ current: null }))
      setTaskStates(states)
      setInitialized(true)
    })
    return () => { cancelled = true }
  }, [request])

  useEffect(() => {
    if (!initialized) return
    const task = request.tasks[currentStep]
    if (!task) return
    const timer = setTimeout(() => {
      const ref = descRefs.current[currentStep]?.current
      if (ref) {
        ref.hydrateText(task.description, new Set())
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [initialized, currentStep, request.tasks])

  const pingActivity = useCallback(() => {
    window.electron.aiTaskStepperActivity(request.requestId)
  }, [request.requestId])

  const handleCancel = useCallback(() => {
    window.electron.aiTaskCreationStepperResult(request.requestId, { cancelled: true })
    onComplete()
  }, [request.requestId, onComplete])

  const updateTaskState = useCallback((index: number, updates: Partial<TaskFormState>) => {
    pingActivity()
    setTaskStates(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s))
  }, [pingActivity])

  const handleProjectTagged = useCallback((index: number, dir: DirectorySettings) => {
    setTaskStates(prev => {
      const state = prev[index]
      if (state.taggedProjects.some(p => p.id === dir.id)) return prev
      const newTagged = [...state.taggedProjects, dir]
      const newConfigs = {
        ...state.projectConfigs,
        [dir.id]: {
          gitStrategy: GIT_STRATEGY.WORKTREE,
          branchName: '',
          baseBranch: defaultBaseBranch,
        },
      }
      return prev.map((s, i) => i === index ? { ...s, taggedProjects: newTagged, projectConfigs: newConfigs } : s)
    })
    pingActivity()
  }, [pingActivity, defaultBaseBranch])

  const handleProjectRemoved = useCallback((index: number, id: string) => {
    setTaskStates(prev => {
      const state = prev[index]
      const newTagged = state.taggedProjects.filter(p => p.id !== id)
      const newConfigs = { ...state.projectConfigs }
      delete newConfigs[id]
      return prev.map((s, i) => i === index ? { ...s, taggedProjects: newTagged, projectConfigs: newConfigs } : s)
    })
    pingActivity()
  }, [pingActivity])

  const handleProjectConfigChange = useCallback((index: number, id: string, updates: Partial<{ gitStrategy: AIGitStrategy; branchName: string; baseBranch: string }>) => {
    setTaskStates(prev => {
      const state = prev[index]
      return prev.map((s, i) => i === index ? {
        ...s,
        projectConfigs: { ...state.projectConfigs, [id]: { ...state.projectConfigs[id], ...updates } },
      } : s)
    })
    pingActivity()
  }, [pingActivity])

  const handleBack = useCallback(() => {
    if (currentStep === 0) return
    setCurrentStep(prev => prev - 1)
    pingActivity()
  }, [currentStep, pingActivity])

  const handleApprove = useCallback(() => {
    const isLast = currentStep === taskStates.length - 1

    setTaskStates(prev => prev.map((s, i) => i === currentStep ? { ...s, approved: true } : s))
    pingActivity()

    if (!isLast) {
      setCurrentStep(prev => prev + 1)
      return
    }

    const approvedTasks: TaskStepperApprovedTask[] = taskStates.map((state, i) => {
      const desc = descRefs.current[i]?.current?.getPlainText().trim() || ''
      const projects: AITaskProject[] = state.taggedProjects.map(p => {
        const config = state.projectConfigs[p.id] || { gitStrategy: GIT_STRATEGY.WORKTREE, branchName: '', baseBranch: defaultBaseBranch }
        return {
          path: p.path,
          label: p.customLabel || p.name,
          gitStrategy: config.gitStrategy,
          ...(config.gitStrategy === GIT_STRATEGY.WORKTREE ? {
            baseBranch: config.baseBranch.trim() || defaultBaseBranch,
            customBranchName: config.branchName.trim() || undefined,
          } : {}),
        }
      })
      const finalTitle = i === currentStep ? taskStates[i].title : state.title
      return {
        title: finalTitle.trim(),
        description: desc,
        projects,
        attachments: state.pendingFiles.map(f => f.path),
      }
    })

    window.electron.aiTaskCreationStepperResult(request.requestId, { tasks: approvedTasks })
    onComplete()
  }, [currentStep, taskStates, request.requestId, onComplete, pingActivity, defaultBaseBranch])

  if (!initialized || taskStates.length === 0) return null

  const currentState = taskStates[currentStep]
  const isLastStep = currentStep === taskStates.length - 1

  return (
    <Dialog open onOpenChange={(isOpen) => { if (!isOpen) handleCancel() }}>
      <DialogContent
        className="!max-w-[95vw] h-[85vh] flex flex-col"
        style={{ background: 'var(--ai-surface-0)', borderColor: 'var(--ai-border-subtle)' }}
        onEscapeKeyDown={handleCancel}
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {taskStates.map((state, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all"
                  style={{
                    width: 8,
                    height: 8,
                    background: i === currentStep
                      ? 'var(--ai-accent)'
                      : state.approved
                        ? 'var(--ai-success)'
                        : 'var(--ai-surface-3)',
                    border: i === currentStep ? '2px solid var(--ai-accent)' : state.approved ? 'none' : '2px solid var(--ai-border)',
                  }}
                />
              ))}
            </div>
            <DialogTitle style={{ color: 'var(--ai-text-primary)' }}>
              Task {currentStep + 1} of {taskStates.length} — {currentState.title || 'Untitled'}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden relative">
          <div
            className="flex h-full"
            style={{
              transition: `transform ${SLIDE_ANIMATION_MS}ms ease-in-out`,
              transform: `translateX(-${currentStep * 100}%)`,
            }}
          >
            {taskStates.map((state, i) => (
              <div key={i} className="flex flex-col h-full" style={{ width: '100%', flexShrink: 0 }}>
                <TaskForm
                  title={state.title}
                  onTitleChange={(title) => updateTaskState(i, { title })}
                  descriptionRef={descRefs.current[i]}
                  taggedProjects={state.taggedProjects}
                  onProjectTagged={(dir) => handleProjectTagged(i, dir)}
                  onProjectRemoved={(id) => handleProjectRemoved(i, id)}
                  projectConfigs={state.projectConfigs}
                  onProjectConfigChange={(id, updates) => handleProjectConfigChange(i, id, updates)}
                  pendingFiles={state.pendingFiles}
                  onFilesChange={(files) => updateTaskState(i, { pendingFiles: files })}
                  boardId={request.boardId}
                  autoFocusTitle={i === 0}
                  defaultBaseBranch={defaultBaseBranch}
                />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            Back
          </Button>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleApprove}
            disabled={!currentState.title.trim()}
            style={{ background: 'var(--ai-accent)', color: 'var(--ai-surface-0)' }}
          >
            {isLastStep ? 'Create All' : 'Approve'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
