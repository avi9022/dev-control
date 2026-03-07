import { useState, useEffect, type FC } from 'react'
import { useAIAutomation } from '@/ui/contexts/ai-automation'
import { AgentTerminal } from '@/ui/components/ai-automation/AgentTerminal'
import { DiffViewer } from '@/ui/components/ai-automation/DiffViewer'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Square, CheckCircle, XCircle, Loader2, FolderOpen, Trash2, GitBranch, MessageSquare } from 'lucide-react'

interface AITaskDetailProps {
  taskId: string
  onBack: () => void
}

const TaskFilesTab: FC<{ taskId: string }> = ({ taskId }) => {
  const [files, setFiles] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [content, setContent] = useState('')

  useEffect(() => {
    window.electron.aiGetTaskFiles(taskId).then(setFiles)
  }, [taskId])

  useEffect(() => {
    if (selectedFile) {
      window.electron.aiReadTaskFile(taskId, selectedFile).then(setContent)
    }
  }, [taskId, selectedFile])

  if (files.length === 0) {
    return <p className="text-neutral-500 text-sm">No task files yet — agents will create files here during execution.</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {files.map(f => (
          <Button
            key={f}
            variant={selectedFile === f ? 'default' : 'outline'}
            size="sm"
            className="text-xs"
            onClick={() => setSelectedFile(f)}
          >
            {f}
          </Button>
        ))}
      </div>
      {selectedFile && (
        <pre className="whitespace-pre-wrap text-sm text-neutral-300 font-mono bg-neutral-900 p-4 rounded border border-neutral-800 max-h-[500px] overflow-y-auto">
          {content || 'Empty file'}
        </pre>
      )}
    </div>
  )
}

export const AITaskDetail: FC<AITaskDetailProps> = ({ taskId, onBack }) => {
  const { tasks, stopTask, moveTaskPhase, updateTask, settings } = useAIAutomation()
  const task = tasks.find(t => t.id === taskId)
  const [reviewComments, setReviewComments] = useState<AIHumanComment[]>([])

  const pipeline = settings?.pipeline || []
  const currentPhaseConfig = pipeline.find(p => p.id === task?.phase)
  const isManualPhase = currentPhaseConfig?.type === 'manual'

  // Load existing comments when task changes
  useEffect(() => {
    if (task?.humanComments) {
      setReviewComments(task.humanComments)
    }
  }, [task?.id])

  if (!task) {
    return (
      <div className="h-full flex items-center justify-center text-neutral-500">
        Task not found
      </div>
    )
  }

  const isAgentRunning = !!task.activeProcessPid

  const handleRequestChanges = async () => {
    await updateTask(task.id, { humanComments: reviewComments })
    // Find previous agent phase to send back to
    const currentIndex = pipeline.findIndex(p => p.id === task.phase)
    let targetPhase = pipeline[0]?.id
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (pipeline[i].type === 'agent') {
        targetPhase = pipeline[i].id
        break
      }
    }
    if (targetPhase) {
      await moveTaskPhase(task.id, targetPhase)
    }
  }

  const handleApprove = async () => {
    if (reviewComments.length > 0) {
      await updateTask(task.id, { humanComments: reviewComments })
    }
    await moveTaskPhase(task.id, 'DONE')
  }

  // Elapsed timer for running agents
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!isAgentRunning) { setElapsed(0); return }
    const currentPhaseEntry = task.phaseHistory[task.phaseHistory.length - 1]
    const startTime = currentPhaseEntry ? new Date(currentPhaseEntry.enteredAt).getTime() : Date.now()
    setElapsed(Math.floor((Date.now() - startTime) / 1000))
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [isAgentRunning, task.phase])

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
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-base font-semibold text-white">{task.title}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-300">{phaseName}</span>
              {task.currentPhaseName && (
                <span className="text-xs text-neutral-500">{task.currentPhaseName} agent</span>
              )}
              {task.branchName && (
                <span className="text-xs text-neutral-500">{task.branchName}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAgentRunning && (
            <Button variant="destructive" size="sm" onClick={() => stopTask(task.id)}>
              <Square className="h-3 w-3 mr-1" />
              Stop
            </Button>
          )}
          {isManualPhase && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRequestChanges}
              >
                <XCircle className="h-3 w-3 mr-1" />
                Request Changes
                {reviewComments.length > 0 && (
                  <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-900/50 text-amber-300">
                    {reviewComments.length}
                  </span>
                )}
              </Button>
              <Button size="sm" onClick={handleApprove}>
                <CheckCircle className="h-3 w-3 mr-1" />
                Approve
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Agent status banner */}
      {isAgentRunning && task.currentPhaseName && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-md bg-neutral-800 border border-neutral-700 flex items-center gap-3">
          <Loader2 className="h-4 w-4 text-blue-400 animate-spin flex-shrink-0" />
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-white">{task.currentPhaseName} agent</span>
            <span className="text-neutral-400">is working</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-400">{phaseName}</span>
            <span className="text-xs font-mono text-neutral-500">{formatElapsed(elapsed)}</span>
          </div>
          {task.projectPaths && task.projectPaths.length > 0 && (
            <span className="ml-auto text-xs text-neutral-500 truncate max-w-[200px]">
              in {task.projectPaths[0].split('/').pop()}
            </span>
          )}
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
              <span className="ml-1 text-[10px] min-w-[16px] h-4 px-1 inline-flex items-center justify-center rounded-full bg-amber-900/50 text-amber-300">
                {reviewComments.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="files">Task Files</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="task" className="flex-1 min-h-0 overflow-y-auto p-4">
          <div className="space-y-4 max-w-2xl">
            <div>
              <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Title</h3>
              <p className="mt-1 text-sm text-white">{task.title}</p>
            </div>
            {task.description && (
              <div>
                <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Description</h3>
                <p className="mt-1 text-sm text-neutral-300 whitespace-pre-wrap">{task.description}</p>
              </div>
            )}
            {task.projectPaths && task.projectPaths.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Projects</h3>
                <div className="mt-1 space-y-1">
                  {task.projectPaths.map(p => (
                    <div key={p} className="flex items-center gap-2 text-sm text-neutral-300">
                      <FolderOpen className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                      <span className="font-medium">{p.split('/').pop()}</span>
                      <span className="text-xs text-neutral-500">{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-6">
              <div>
                <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Git Strategy</h3>
                <p className="mt-1 text-sm text-neutral-300">{task.gitStrategy}</p>
              </div>
              <div>
                <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Max Review Cycles</h3>
                <p className="mt-1 text-sm text-neutral-300">{task.maxReviewCycles}</p>
              </div>
              <div>
                <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Review Cycles Used</h3>
                <p className="mt-1 text-sm text-neutral-300">{task.reviewCycleCount}</p>
              </div>
            </div>
            {task.worktreePath && (
              <div>
                <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Worktree</h3>
                <div className="mt-1 flex items-center gap-2">
                  <GitBranch className="h-3.5 w-3.5 text-neutral-500 flex-shrink-0" />
                  <span className="text-sm text-neutral-300 font-mono truncate">{task.worktreePath}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    disabled={isAgentRunning}
                    onClick={async () => {
                      if (confirm('Remove this worktree? The branch will be kept.')) {
                        await window.electron.aiRemoveWorktree(task.id)
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            )}
            {/* Previous human comments (from earlier review cycles) */}
            {task.humanComments && task.humanComments.length > 0 && !isManualPhase && (
              <div>
                <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Previous Review Comments</h3>
                <div className="mt-1 space-y-1">
                  {task.humanComments.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm p-2 rounded bg-amber-900/10 border border-amber-900/20">
                      <MessageSquare className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs text-neutral-500 font-mono">{c.file}:{c.line}</span>
                        <p className="text-xs text-neutral-300 mt-0.5">{c.comment}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Created</h3>
              <p className="mt-1 text-sm text-neutral-300">{new Date(task.createdAt).toLocaleString()}</p>
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
          />
        </TabsContent>

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
                  <span className="text-neutral-500 w-[160px] text-xs font-mono">
                    {new Date(entry.enteredAt).toLocaleString()}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 text-xs">
                    {displayName}
                  </span>
                  {entry.exitedAt && (
                    <span className="text-neutral-600 text-xs">
                      exited {new Date(entry.exitedAt).toLocaleString()}
                    </span>
                  )}
                </div>
              )
            })}
            {task.reviewCycleCount > 0 && (
              <div className="mt-4 text-xs text-neutral-500">
                Review cycles: {task.reviewCycleCount}/{task.maxReviewCycles}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
