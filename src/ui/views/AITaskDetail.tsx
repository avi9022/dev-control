import { useState, useEffect, type FC } from 'react'
import { useAIAutomation } from '@/ui/contexts/ai-automation'
import { AgentTerminal } from '@/ui/components/ai-automation/AgentTerminal'
import { DiffViewer } from '@/ui/components/ai-automation/DiffViewer'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Square, CheckCircle, XCircle, Loader2, FolderOpen, Trash2, GitBranch, MessageSquare, Pencil, Plus, X, Paperclip } from 'lucide-react'

interface AITaskDetailProps {
  taskId: string
  onBack: () => void
}

const TaskFilesTab: FC<{ taskId: string }> = ({ taskId }) => {
  const [agentFiles, setAgentFiles] = useState<string[]>([])
  const [attachments, setAttachments] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [content, setContent] = useState('')

  const loadFiles = () => {
    window.electron.aiGetTaskFiles(taskId).then(setAgentFiles)
    window.electron.aiListTaskAttachments(taskId).then(setAttachments)
  }

  useEffect(() => { loadFiles() }, [taskId])

  useEffect(() => {
    if (selectedFile) {
      window.electron.aiReadTaskFile(taskId, selectedFile).then(setContent)
    }
  }, [taskId, selectedFile])

  return (
    <div className="space-y-4">
      {/* Attachments section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Attachments</h3>
          <Button variant="outline" size="sm" onClick={async () => {
            const selected = await window.electron.aiSelectFiles()
            if (selected && selected.length > 0) {
              await window.electron.aiAttachTaskFiles(taskId, selected)
              loadFiles()
            }
          }}>
            <Paperclip className="h-3 w-3 mr-1" /> Attach Files
          </Button>
        </div>
        {attachments.length === 0 ? (
          <p className="text-neutral-600 text-xs">No attachments. Click "Attach Files" to add reference files for agents.</p>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {attachments.map(f => (
              <div key={f} className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-xs text-neutral-300">
                <Paperclip className="h-3 w-3 text-neutral-500" />
                {f}
                <button
                  onClick={async () => {
                    await window.electron.aiDeleteTaskAttachment(taskId, f)
                    loadFiles()
                  }}
                  className="ml-1 text-red-400 hover:text-red-300"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agent files section */}
      <div>
        <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Agent Files</h3>
        {agentFiles.length === 0 ? (
          <p className="text-neutral-600 text-xs">No agent files yet — agents will create files here during execution.</p>
        ) : (
          <>
            <div className="flex gap-2 flex-wrap">
              {agentFiles.map(f => (
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
              <pre className="mt-3 whitespace-pre-wrap text-sm text-neutral-300 font-mono bg-neutral-900 p-4 rounded border border-neutral-800 max-h-[500px] overflow-y-auto">
                {content || 'Empty file'}
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export const AITaskDetail: FC<AITaskDetailProps> = ({ taskId, onBack }) => {
  const { tasks, stopTask, moveTaskPhase, updateTask, settings } = useAIAutomation()
  const task = tasks.find(t => t.id === taskId)
  const [reviewComments, setReviewComments] = useState<AIHumanComment[]>([])

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editGitStrategy, setEditGitStrategy] = useState<AIGitStrategy>('worktree')
  const [editBaseBranch, setEditBaseBranch] = useState('')
  const [editProjectPaths, setEditProjectPaths] = useState<string[]>([])

  const pipeline = settings?.pipeline || []
  const currentPhaseConfig = pipeline.find(p => p.id === task?.phase)
  const isManualPhase = currentPhaseConfig?.type === 'manual'
  const canEdit = task?.phase === 'BACKLOG'

  const startEditing = () => {
    if (!task) return
    setEditTitle(task.title)
    setEditDescription(task.description)
    setEditGitStrategy(task.gitStrategy)
    setEditBaseBranch(task.baseBranch || '')
    setEditProjectPaths(task.projectPaths || [])
    setEditing(true)
  }

  const saveEdit = async () => {
    await updateTask(task!.id, {
      title: editTitle.trim(),
      description: editDescription.trim(),
      gitStrategy: editGitStrategy,
      baseBranch: editBaseBranch.trim() || undefined,
      projectPaths: editProjectPaths.length > 0 ? editProjectPaths : undefined
    })
    setEditing(false)
  }

  const cancelEdit = () => setEditing(false)

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
              {editing ? (
                <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="mt-1" />
              ) : (
                <p className="mt-1 text-sm text-white">{task.title}</p>
              )}
            </div>
            <div>
              <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Description</h3>
              {editing ? (
                <Textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={6} className="mt-1" />
              ) : (
                task.description && <p className="mt-1 text-sm text-neutral-300 whitespace-pre-wrap">{task.description}</p>
              )}
            </div>
            <div>
              <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Projects</h3>
              {editing ? (
                <div className="mt-1 space-y-2">
                  {editProjectPaths.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-sm text-neutral-300 flex-1 truncate">{p}</span>
                      <Button variant="ghost" size="sm" onClick={() => setEditProjectPaths(prev => prev.filter((_, j) => j !== i))}>
                        <X className="h-3 w-3 text-red-400" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={async () => {
                    const selected = await window.electron.aiSelectDirectory()
                    if (selected && !editProjectPaths.includes(selected)) {
                      setEditProjectPaths(prev => [...prev, selected])
                    }
                  }}>
                    <Plus className="h-3 w-3 mr-1" /> Add Project
                  </Button>
                </div>
              ) : (
                task.projectPaths && task.projectPaths.length > 0 ? (
                  <div className="mt-1 space-y-1">
                    {task.projectPaths.map(p => (
                      <div key={p} className="flex items-center gap-2 text-sm text-neutral-300">
                        <FolderOpen className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                        <span className="font-medium">{p.split('/').pop()}</span>
                        <span className="text-xs text-neutral-500">{p}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-neutral-500">No projects tagged</p>
                )
              )}
            </div>
            <div className="flex gap-6">
              <div>
                <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Git Strategy</h3>
                {editing ? (
                  <Select value={editGitStrategy} onValueChange={(v) => setEditGitStrategy(v as AIGitStrategy)}>
                    <SelectTrigger className="mt-1 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="worktree">Worktree</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="mt-1 text-sm text-neutral-300">{task.gitStrategy}</p>
                )}
              </div>
              {(editing ? editGitStrategy === 'worktree' : task.gitStrategy === 'worktree') && (
                <div>
                  <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Base Branch</h3>
                  {editing ? (
                    <Input value={editBaseBranch} onChange={e => setEditBaseBranch(e.target.value)} placeholder="main" className="mt-1 w-32" />
                  ) : (
                    <p className="mt-1 text-sm text-neutral-300">{task.baseBranch || 'auto'}</p>
                  )}
                </div>
              )}
            </div>
            {task.worktrees && task.worktrees.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Worktrees</h3>
                {task.worktrees.map((wt, i) => (
                  <div key={i} className="mt-1 flex items-center gap-2">
                    <GitBranch className="h-3.5 w-3.5 text-neutral-500 flex-shrink-0" />
                    <span className="text-sm text-neutral-300 font-mono truncate">{wt.worktreePath}</span>
                    <span className="text-xs text-neutral-500">({wt.branchName})</span>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-6 px-2 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                  disabled={isAgentRunning}
                  onClick={async () => {
                    if (confirm('Remove all worktrees? The branches will be kept.')) {
                      await window.electron.aiRemoveWorktree(task.id)
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Remove Worktrees
                </Button>
              </div>
            )}
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
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
