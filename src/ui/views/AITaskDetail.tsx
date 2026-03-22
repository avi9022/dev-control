import { useState, useEffect, useRef, type FC } from 'react'
import { useAIAutomation } from '@/ui/contexts/ai-automation'
import { AgentTerminal } from '@/ui/components/ai-automation/AgentTerminal'
import { DiffViewer } from '@/ui/components/ai-automation/DiffViewer'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ArrowLeft, Square, CheckCircle, XCircle, Loader2, FolderOpen, Pencil, FilePlus, TerminalSquare, ChevronDown, Cpu, FileText, AlertTriangle } from 'lucide-react'
import { AgentStatsModal } from '@/ui/components/ai-automation/AgentStatsModal'
import { ContextHistoryModal } from '@/ui/components/ai-automation/ContextHistoryModal'
import { XtermTerminal } from '@/ui/components/ai-automation/XtermTerminal'
import { AmendmentForm } from '@/ui/components/ai-automation/AmendmentForm'
import { TaskDevControl } from '@/ui/components/ai-automation/TaskDevControl'
import { type MentionEditorHandle } from '@/ui/components/ai-automation/MentionEditor'
import { TaskDetailsCard } from '@/ui/components/ai-automation/TaskDetailsCard'
import { ReviewCommentsCard } from '@/ui/components/ai-automation/ReviewCommentsCard'
import { SourceGitCard } from '@/ui/components/ai-automation/SourceGitCard'
import { TaskFilesTab } from '@/ui/components/ai-automation/TaskFilesTab'
import { AmendmentsTab } from '@/ui/components/ai-automation/AmendmentsTab'

interface AITaskDetailProps {
  taskId: string
  onBack: () => void
  onSelectTask?: (taskId: string) => void
}

export const AITaskDetail: FC<AITaskDetailProps> = ({ taskId, onBack, onSelectTask }) => {
  const { tasks, stopTask, moveTaskPhase, updateTask, settings, updateSettings } = useAIAutomation()
  const themeClass = ''
  const task = tasks.find(t => t.id === taskId)
  const [reviewComments, setReviewCommentsLocal] = useState<AIHumanComment[]>([])

  const setReviewComments = (comments: AIHumanComment[]) => {
    setReviewCommentsLocal(comments)
    if (task) {
      updateTask(task.id, { humanComments: comments })
    }
  }

  const [showAmendDialog, setShowAmendDialog] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editProjects, setEditProjects] = useState<AITaskProject[]>([])
  const editDescRef = useRef<MentionEditorHandle>(null)

  const taskBoard = settings?.boards?.find(b => b.id === task?.boardId)
  const pipeline = taskBoard?.pipeline || []
  const currentPhaseConfig = pipeline.find(p => p.id === task?.phase)
  const isManualPhase = currentPhaseConfig?.type === 'manual'
  const canEdit = task?.phase === 'BACKLOG'

  const startEditing = () => {
    if (!task) return
    setEditTitle(task.title)
    setEditProjects(task.projects ? task.projects.map(p => ({ ...p })) : [])
    setEditing(true)
    // Hydrate editor on next tick after it mounts
    const labels = new Set((task.projects || []).map(p => p.label))
    const taskMap = new Map<string, string>()
    for (const t of tasks) {
      if (t.id !== task.id) taskMap.set(t.id.slice(0, 8), t.title)
    }
    setTimeout(() => {
      editDescRef.current?.hydrateText(task.description, labels, taskMap)
    }, 0)
  }

  const saveEdit = async () => {
    const description = editDescRef.current?.getPlainText().trim() || ''
    await updateTask(task!.id, {
      title: editTitle.trim(),
      description,
      projects: editProjects
    })
    setEditing(false)
  }

  const cancelEdit = () => setEditing(false)

  const [showRequestChanges, setShowRequestChanges] = useState(false)
  const [generalComment, setGeneralComment] = useState('')
  const [requestChangesPhase, setRequestChangesPhase] = useState<string>('')
  const [showApproveTarget, setShowApproveTarget] = useState(false)
  const [showTerminal, setShowTerminal] = useState(false)
  const [approvePhase, setApprovePhase] = useState<string>('')
  const [elapsed, setElapsed] = useState(0)
  const [showStatsModal, setShowStatsModal] = useState(false)
  const [contextHistoryEntry, setContextHistoryEntry] = useState<{ path: string; phaseName: string } | null>(null)
  const [agentStats, setAgentStats] = useState<AIAgentStats | null>(null)

  // Subscribe to live agent stats + fetch current on mount
  useEffect(() => {
    if (!task?.id) return
    // Fetch current stats in case agent is already running
    window.electron.aiGetAgentStats(task.id).then(s => {
      if (s) setAgentStats(s)
    })
    const unsub = window.electron.subscribeAIAgentStats((data) => {
      if (data.taskId === task.id) setAgentStats(data)
    })
    return () => { unsub?.() }
  }, [task?.id])

  // Load existing comments when task changes, backfill missing IDs
  useEffect(() => {
    if (task?.humanComments) {
      setReviewCommentsLocal(task.humanComments.map(c => ({
        ...c,
        id: c.id || crypto.randomUUID(),
        createdAt: c.createdAt || '',
      })))
    }
  }, [task?.id, task?.humanComments])

  const isAgentRunning = !!task?.activeProcessPid

  // Elapsed timer for running agents
  useEffect(() => {
    if (!isAgentRunning || !task) { setElapsed(0); return }
    const currentPhaseEntry = task.phaseHistory[task.phaseHistory.length - 1]
    const startTime = currentPhaseEntry ? new Date(currentPhaseEntry.enteredAt).getTime() : Date.now()
    setElapsed(Math.floor((Date.now() - startTime) / 1000))
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [isAgentRunning, task])

  if (!task) {
    return (
      <div className="h-full flex items-center justify-center" style={{ color: 'var(--ai-text-tertiary)' }}>
        Task not found
      </div>
    )
  }

  const handleAmendment = async (text: string, targetPhase: string, newProjects?: AITaskProject[]) => {
    const amendment: AITaskAmendment = {
      id: crypto.randomUUID(),
      text,
      targetPhase,
      createdAt: new Date().toISOString()
    }
    const existing = task.amendments || []
    const updates: Partial<AITask> = { amendments: [...existing, amendment] }
    if (newProjects?.length) {
      updates.projects = [...(task.projects || []), ...newProjects]
    }
    await updateTask(task.id, updates)
    await moveTaskPhase(task.id, targetPhase)
    setShowAmendDialog(false)
  }

  const handleRequestChanges = async () => {
    const allComments = [...reviewComments]
    if (generalComment.trim()) {
      allComments.push({
        id: crypto.randomUUID(),
        file: '',
        line: 0,
        comment: generalComment.trim(),
        createdAt: new Date().toISOString()
      })
    }
    await updateTask(task.id, { humanComments: allComments })
    setGeneralComment('')
    setShowRequestChanges(false)
    if (requestChangesPhase) {
      await moveTaskPhase(task.id, requestChangesPhase)
    }
  }

  const handleApprove = async (targetPhase?: string) => {
    if (reviewComments.length > 0) {
      await updateTask(task.id, { humanComments: reviewComments })
    }
    const phase = targetPhase || settings?.defaultApprovePhase || 'DONE'
    await moveTaskPhase(task.id, phase)
    setShowApproveTarget(false)
  }

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`
  }

  // Get display name for current phase
  const phaseName = currentPhaseConfig?.name || task.phase.replace(/[-_]/g, ' ')

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--ai-border-subtle)' }}
      >
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--ai-text-primary)' }}>{task.title}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ backgroundColor: 'var(--ai-surface-3)', color: 'var(--ai-text-secondary)' }}
              >
                {phaseName}
              </span>
              {task.currentPhaseName && (
                <span className="text-xs" style={{ color: 'var(--ai-text-tertiary)' }}>{task.currentPhaseName} agent</span>
              )}
              {task.branchName && (
                <span className="text-xs" style={{ color: 'var(--ai-text-tertiary)' }}>{task.branchName}</span>
              )}
              <button
                onClick={() => navigator.clipboard.writeText(task.id)}
                className="text-[10px] font-mono transition-colors"
                style={{ color: 'var(--ai-text-tertiary)', opacity: 0.7 }}
                title="Click to copy task ID"
              >
                {task.id.slice(0, 8)}
              </button>
              <button
                onClick={() => window.electron.aiOpenTaskDir(task.id)}
                className="transition-colors"
                style={{ color: 'var(--ai-text-tertiary)', opacity: 0.7 }}
                title="Open task directory"
              >
                <FolderOpen className="h-3 w-3" />
              </button>
              {task.taskDirPath && (
                <button
                  onClick={() => setShowTerminal(true)}
                  className="transition-colors"
                  style={{ color: 'var(--ai-text-tertiary)', opacity: 0.7 }}
                  title="Open terminal in task directory"
                >
                  <TerminalSquare className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showAmendDialog} onOpenChange={setShowAmendDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <FilePlus className="h-3 w-3 mr-1" /> Amend
              </Button>
            </DialogTrigger>
            <DialogContent className={`${themeClass} !max-w-[95vw] h-[85vh] flex flex-col`} style={{ background: 'var(--ai-surface-0)', borderColor: 'var(--ai-border-subtle)' }}>
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>Add Amendment</DialogTitle>
              </DialogHeader>
              <div className="overflow-y-auto flex-1 min-h-0 pr-1">
              <AmendmentForm
                pipeline={pipeline}
                onSubmit={handleAmendment}
                onCancel={() => setShowAmendDialog(false)}
                existingProjects={task.projects || []}
                existingWorktrees={task.worktrees || []}
                defaultPhase={settings?.defaultAmendmentPhase}
                defaultGitStrategy={settings?.defaultGitStrategy}
                defaultBaseBranch={settings?.defaultBaseBranch}
                taskId={task.id}
                boardId={task.boardId}
              />
              </div>
            </DialogContent>
          </Dialog>
          {canEdit && !editing && (
            <Button variant="outline" size="sm" onClick={startEditing}>
              <Pencil className="h-3 w-3 mr-1" /> Edit
            </Button>
          )}
          {editing && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={cancelEdit}>Cancel</Button>
              <Button size="sm" onClick={saveEdit}>Save</Button>
            </div>
          )}
          {isAgentRunning && (
            <>
              {agentStats && (() => {
                const pct = Math.min(100, Math.round((agentStats.inputTokens / agentStats.contextWindowMax) * 100))
                const color = pct > 80 ? 'var(--ai-pink)' : pct > 60 ? 'var(--ai-warning)' : 'var(--ai-success)'
                return (
                  <button
                    onClick={() => setShowStatsModal(true)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors"
                    style={{ borderColor: 'var(--ai-border-subtle)', backgroundColor: 'color-mix(in srgb, var(--ai-surface-2) 50%, transparent)' }}
                    title="Agent stats — click for details"
                  >
                    <Cpu className="h-3 w-3" style={{ color }} />
                    <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--ai-surface-3)' }}>
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                    <span className="text-[10px] font-mono font-medium" style={{ color }}>{pct}%</span>
                  </button>
                )
              })()}
              <Button variant="destructive" size="sm" onClick={() => stopTask(task.id)}>
                <Square className="h-3 w-3 mr-1" />
                Stop
              </Button>
            </>
          )}
          {task && (
            <AgentStatsModal
              taskId={task.id}
              open={showStatsModal}
              onOpenChange={setShowStatsModal}
              themeClass={themeClass}
            />
          )}
          {isManualPhase && (
            <div className="relative flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowRequestChanges(prev => {
                    if (!prev) {
                      const defaultPhase = settings?.defaultRequestChangesPhase
                      if (defaultPhase && pipeline.some(p => p.id === defaultPhase)) {
                        setRequestChangesPhase(defaultPhase)
                      } else {
                        const currentIndex = pipeline.findIndex(p => p.id === task.phase)
                        let fallback = pipeline[0]?.id || ''
                        for (let i = currentIndex - 1; i >= 0; i--) {
                          if (pipeline[i].type === 'agent') {
                            fallback = pipeline[i].id
                            break
                          }
                        }
                        setRequestChangesPhase(fallback)
                      }
                    }
                    return !prev
                  })
                }}
              >
                <XCircle className="h-3 w-3 mr-1" />
                Request Changes
                {reviewComments.filter(c => !c.resolved).length > 0 && (
                  <span
                    className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--ai-warning-subtle)', color: 'var(--ai-warning)' }}
                  >
                    {reviewComments.filter(c => !c.resolved).length}
                  </span>
                )}
              </Button>
              {showRequestChanges && (
                <div
                  className="absolute top-full right-0 mt-2 w-80 z-50 rounded-lg shadow-xl p-3 space-y-3"
                  style={{
                    border: '1px solid var(--ai-border-subtle)',
                    backgroundColor: 'var(--ai-surface-2)',
                  }}
                >
                  <h4 className="text-xs font-medium" style={{ color: 'var(--ai-text-secondary)' }}>General Feedback</h4>
                  <textarea
                    value={generalComment}
                    onChange={e => setGeneralComment(e.target.value)}
                    placeholder="Add overall feedback (optional)..."
                    className="w-full min-h-[80px] rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 resize-y"
                    style={{
                      border: '1px solid var(--ai-border)',
                      backgroundColor: 'var(--ai-surface-0)',
                      color: 'var(--ai-text-primary)',
                    }}
                    rows={3}
                    autoFocus
                  />
                  <div className="text-[10px]" style={{ color: 'var(--ai-text-tertiary)' }}>
                    {reviewComments.filter(c => !c.resolved).length} unresolved inline comment{reviewComments.filter(c => !c.resolved).length !== 1 ? 's' : ''} will also be sent
                  </div>
                  <div>
                    <label className="text-[10px] font-medium mb-1 block" style={{ color: 'var(--ai-text-tertiary)' }}>Send to Phase</label>
                    <Select value={requestChangesPhase} onValueChange={setRequestChangesPhase}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="Select phase..." />
                      </SelectTrigger>
                      <SelectContent>
                        {pipeline.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setShowRequestChanges(false); setGeneralComment('') }}>
                      Cancel
                    </Button>
                    <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={handleRequestChanges}>
                      Submit Review
                    </Button>
                  </div>
                </div>
              )}
              <div className="relative flex items-center">
                <Button
                  size="sm"
                  className="rounded-r-none"
                  style={{ background: 'var(--ai-accent)', color: 'var(--ai-surface-0)' }}
                  onClick={() => {
                    if (settings?.approveSkipConfirm) {
                      handleApprove()
                    } else {
                      setShowApproveTarget(prev => {
                        if (!prev) {
                          setApprovePhase(settings?.defaultApprovePhase || 'DONE')
                        }
                        return !prev
                      })
                    }
                  }}
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  className="rounded-l-none px-1.5"
                  style={{ background: 'var(--ai-accent)', color: 'var(--ai-surface-0)', borderLeft: '1px solid var(--ai-surface-0)', opacity: 0.9 }}
                  onClick={() => setShowApproveTarget(prev => {
                    if (!prev) setApprovePhase(settings?.defaultApprovePhase || 'DONE')
                    return !prev
                  })}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
                {showApproveTarget && (
                  <div
                    className="absolute top-full right-0 mt-2 w-56 z-50 rounded-lg shadow-xl p-3 space-y-3"
                    style={{ border: '1px solid var(--ai-border-subtle)', backgroundColor: 'var(--ai-surface-2)' }}
                  >
                    <div>
                      <label className="text-[10px] font-medium mb-1 block" style={{ color: 'var(--ai-text-tertiary)' }}>Send to</label>
                      <Select value={approvePhase} onValueChange={setApprovePhase}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Select target..." />
                        </SelectTrigger>
                        <SelectContent>
                          {pipeline.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                          <SelectItem value="DONE">Done</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowApproveTarget(false)}>
                        Cancel
                      </Button>
                      <Button size="sm" className="h-7 text-xs" style={{ background: 'var(--ai-accent)', color: 'var(--ai-surface-0)' }} onClick={() => handleApprove(approvePhase)}>
                        Confirm
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Agent status banner */}
      {isAgentRunning && task.currentPhaseName && (
        <div
          className="mx-4 mt-3 px-3 py-2 rounded-md flex items-center gap-3"
          style={{
            backgroundColor: 'var(--ai-surface-2)',
            border: '1px solid var(--ai-border-subtle)',
          }}
        >
          <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" style={{ color: 'var(--ai-accent)' }} />
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium" style={{ color: 'var(--ai-text-primary)' }}>{task.currentPhaseName} agent</span>
            <span style={{ color: 'var(--ai-text-tertiary)' }}>is working</span>
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--ai-surface-3)', color: 'var(--ai-text-tertiary)' }}
            >
              {phaseName}
            </span>
            <span className="text-xs font-mono" style={{ color: 'var(--ai-text-tertiary)' }}>{formatElapsed(elapsed)}</span>
          </div>
          {task.projects && task.projects.length > 0 && (
            <span className="ml-auto text-xs truncate max-w-[200px]" style={{ color: 'var(--ai-text-tertiary)' }}>
              in {task.projects[0].label}
            </span>
          )}
        </div>
      )}

      {/* Needs user input warning banner */}
      {task.needsUserInput && (
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg mx-4 mb-3 mt-3"
          style={{
            backgroundColor: 'var(--ai-warning-subtle)',
            border: '1px solid var(--ai-warning)',
          }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: 'var(--ai-warning)' }} />
          <span className="text-sm flex-1" style={{ color: 'var(--ai-warning)' }}>
            {task.needsUserInputReason === 'crashed' && 'This agent was interrupted when the app closed'}
            {task.needsUserInputReason === 'max_retries' && 'This agent stalled repeatedly and stopped after 3 retries'}
            {task.needsUserInputReason === 'error' && 'This agent exited with an error'}
            {!task.needsUserInputReason && 'This task needs attention'}
          </span>
          <Button
            size="sm"
            className="h-7 text-xs"
            style={{ background: 'var(--ai-accent)', color: 'var(--ai-surface-0)' }}
            onClick={() => moveTaskPhase(task.id, task.phase)}
          >
            Retry Phase
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => moveTaskPhase(task.id, 'BACKLOG')}
          >
            Move to Backlog
          </Button>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue={isManualPhase ? 'changes' : 'terminal'} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-4 mt-2 w-fit">
          <TabsTrigger value="task">Task</TabsTrigger>
          <TabsTrigger value="terminal">Terminal</TabsTrigger>
          <TabsTrigger value="changes" className="relative">
            Changes
            {reviewComments.length > 0 && (
              <span
                className="ml-1 text-[10px] min-w-[16px] h-4 px-1 inline-flex items-center justify-center rounded-full"
                style={{ backgroundColor: 'var(--ai-warning-subtle)', color: 'var(--ai-warning)' }}
              >
                {reviewComments.length}
              </span>
            )}
          </TabsTrigger>
          {task.worktrees && task.worktrees.length > 0 && (
            <TabsTrigger value="devcontrol">Dev Control</TabsTrigger>
          )}
          <TabsTrigger value="files">Task Files</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="amendments" className="relative">
            Amendments
            {(task.amendments?.length || 0) > 0 && (
              <span
                className="ml-1 text-[10px] min-w-[16px] h-4 px-1 inline-flex items-center justify-center rounded-full"
                style={{ backgroundColor: 'var(--ai-accent-subtle)', color: 'var(--ai-accent)' }}
              >
                {task.amendments!.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="task" className="flex-1 min-h-0 overflow-y-auto p-5">
          <div className="flex gap-5">
            {/* Left column */}
            <div className="flex-1 min-w-0 space-y-5">
              <TaskDetailsCard
                task={task}
                editing={editing}
                editTitle={editTitle}
                setEditTitle={setEditTitle}
                editProjects={editProjects}
                setEditProjects={setEditProjects}
                editDescRef={editDescRef}
                settings={settings}
                allTasks={tasks}
                onTaskClick={onSelectTask}
                boardId={task.boardId}
                excludeTaskIds={new Set([task.id])}
              />
              <ReviewCommentsCard
                task={task}
                pipeline={pipeline}
                isManualPhase={isManualPhase}
              />
            </div>

            {/* Right column */}
            <div className="flex-1 min-w-0">
              <SourceGitCard
                task={task}
                editing={editing}
                editProjects={editProjects}
                setEditProjects={setEditProjects}
                isAgentRunning={isAgentRunning}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="terminal" className="flex-1 min-h-0 m-0 p-4">
          <AgentTerminal taskId={task.id} needsUserInput={task.needsUserInput} />
        </TabsContent>

        <TabsContent value="changes" className="flex-1 min-h-0 overflow-hidden p-4">
          <DiffViewer
            taskId={task.id}
            comments={reviewComments}
            onCommentsChange={setReviewComments}
            readOnly={!isManualPhase}
            settings={settings || undefined}
            onUpdateSettings={updateSettings}
          />
        </TabsContent>

        {task.worktrees && task.worktrees.length > 0 && (
          <TabsContent value="devcontrol" className="flex-1 min-h-0 p-4">
            <TaskDevControl taskId={task.id} />
          </TabsContent>
        )}

        <TabsContent value="files" className="flex-1 min-h-0 overflow-y-auto p-4">
          <TaskFilesTab taskId={task.id} />
        </TabsContent>

        <TabsContent value="history" className="flex-1 min-h-0 overflow-y-auto p-4">
          <div className="space-y-2">
            {task.phaseHistory.map((entry, i) => {
              const phaseConf = pipeline.find(p => p.id === entry.phase)
              const displayName = phaseConf?.name || entry.phase.replace(/[-_]/g, ' ')
              return (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-[160px] text-xs font-mono" style={{ color: 'var(--ai-text-tertiary)' }}>
                    {new Date(entry.enteredAt).toLocaleString()}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded text-xs"
                    style={{ backgroundColor: 'var(--ai-surface-2)', color: 'var(--ai-text-secondary)' }}
                  >
                    {displayName}
                  </span>
                  {entry.exitedAt && (
                    <span className="text-xs" style={{ color: 'var(--ai-text-tertiary)' }}>
                      exited {new Date(entry.exitedAt).toLocaleString()}
                    </span>
                  )}
                  {entry.exitEvent && entry.exitEvent !== 'completed' && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: entry.exitEvent === 'stopped' ? 'var(--ai-surface-3)' : 'var(--ai-warning-subtle)',
                        color: entry.exitEvent === 'stopped' ? 'var(--ai-text-tertiary)' : 'var(--ai-warning)',
                      }}
                    >
                      {entry.exitEvent === 'stopped' && 'manually stopped'}
                      {entry.exitEvent === 'crashed' && 'app crashed'}
                      {entry.exitEvent === 'stalled' && 'stalled'}
                      {entry.exitEvent === 'error' && 'error'}
                    </span>
                  )}
                  {entry.contextHistoryPath && (
                    <button
                      onClick={() => setContextHistoryEntry({ path: entry.contextHistoryPath!, phaseName: displayName })}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors"
                      style={{ color: 'var(--ai-accent)', backgroundColor: 'var(--ai-accent-subtle)' }}
                      title="View context history"
                    >
                      <FileText className="h-3 w-3" />
                      Context
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          {contextHistoryEntry && (
            <ContextHistoryModal
              contextHistoryPath={contextHistoryEntry.path}
              phaseName={contextHistoryEntry.phaseName}
              open={!!contextHistoryEntry}
              onOpenChange={(open) => { if (!open) setContextHistoryEntry(null) }}
              themeClass={themeClass}
            />
          )}
        </TabsContent>

        <TabsContent value="amendments" className="flex-1 min-h-0 overflow-y-auto p-4">
          <AmendmentsTab task={task} pipeline={pipeline} />
        </TabsContent>
      </Tabs>

      {/* Terminal dialog */}
      <Dialog open={showTerminal} onOpenChange={(open) => { if (!open) setShowTerminal(false) }}>
        <DialogContent
          className={`${themeClass} !max-w-[800px] h-[70vh] flex flex-col !p-0`}
          style={{ background: 'var(--ai-surface-0)', borderColor: 'var(--ai-border-subtle)' }}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="flex items-center gap-2 text-sm" style={{ color: 'var(--ai-text-primary)' }}>
              <TerminalSquare className="h-4 w-4" style={{ color: 'var(--ai-accent)' }} />
              Terminal
              <span className="text-[10px] font-mono font-normal truncate" style={{ color: 'var(--ai-text-tertiary)' }}>
                {task.taskDirPath}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 px-2 pb-2">
            {showTerminal && task.taskDirPath && (
              <XtermTerminal cwd={task.taskDirPath} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
