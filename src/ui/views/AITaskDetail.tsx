import { useState, useEffect, useRef, type FC } from 'react'
import { useAIAutomation } from '@/ui/contexts/ai-automation'
import { AgentTerminal } from '@/ui/components/ai-automation/AgentTerminal'
import { DiffViewer } from '@/ui/components/ai-automation/DiffViewer'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Square, CheckCircle, XCircle, Loader2, FolderOpen, Trash2, GitBranch, MessageSquare, Pencil, Plus, X, Paperclip, Check, List, LayoutGrid, FolderTree, FileText, ChevronRight, ChevronDown } from 'lucide-react'
import { renderMentions } from '@/ui/components/ai-automation/mention-utils'
import { TaskDevControl } from '@/ui/components/ai-automation/TaskDevControl'
import { MentionEditor, type MentionEditorHandle } from '@/ui/components/ai-automation/MentionEditor'

interface AITaskDetailProps {
  taskId: string
  onBack: () => void
}

type FileViewMode = 'list' | 'grid' | 'tree'
type FileEntry = { name: string; prefix: 'agent' | 'attachments'; excluded: boolean }

const FileCheckbox: FC<{ excluded: boolean; onToggle: (e: React.MouseEvent) => void }> = ({ excluded, onToggle }) => (
  <button
    onClick={onToggle}
    className={`flex-shrink-0 w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors ${
      excluded ? 'border-neutral-600 bg-neutral-800 hover:border-neutral-500' : 'border-blue-500 bg-blue-600 hover:bg-blue-500'
    }`}
    title={excluded ? 'Include in agent prompts' : 'Exclude from agent prompts'}
  >
    {!excluded && <Check className="h-2.5 w-2.5 text-white" />}
  </button>
)

const FileIcon: FC<{ prefix: string; className?: string }> = ({ prefix, className = 'h-3.5 w-3.5' }) => (
  prefix === 'attachments'
    ? <Paperclip className={`${className} text-blue-400`} />
    : <FileText className={`${className} text-neutral-400`} />
)

// --- List View ---
const FileListView: FC<{
  files: FileEntry[]
  selectedFile: { name: string; type: string } | null
  onSelect: (f: FileEntry) => void
  onToggleExclude: (f: FileEntry) => void
  onDelete: (f: FileEntry) => void
}> = ({ files, selectedFile, onSelect, onToggleExclude, onDelete }) => (
  <div className="border border-neutral-700 rounded-md overflow-hidden">
    {files.map((f, i) => (
      <div
        key={`${f.prefix}/${f.name}`}
        onClick={() => onSelect(f)}
        className={`group flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors ${
          i > 0 ? 'border-t border-neutral-800' : ''
        } ${
          selectedFile?.name === f.name && selectedFile?.type === f.prefix
            ? 'bg-neutral-700/50'
            : f.excluded ? 'bg-neutral-900/50' : 'hover:bg-neutral-800/50'
        }`}
      >
        <FileCheckbox excluded={f.excluded} onToggle={e => { e.stopPropagation(); onToggleExclude(f) }} />
        <FileIcon prefix={f.prefix} />
        <span className={`flex-1 text-xs truncate ${f.excluded ? 'text-neutral-600 line-through' : 'text-neutral-300'}`}>
          {f.name}
        </span>
        <span className="text-[10px] text-neutral-600 mr-2">{f.prefix === 'attachments' ? 'attached' : 'agent'}</span>
        <button
          onClick={e => { e.stopPropagation(); onDelete(f) }}
          className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          title="Delete file"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    ))}
  </div>
)

// --- Grid View ---
const FileGridView: FC<{
  files: FileEntry[]
  selectedFile: { name: string; type: string } | null
  onSelect: (f: FileEntry) => void
  onToggleExclude: (f: FileEntry) => void
  onDelete: (f: FileEntry) => void
}> = ({ files, selectedFile, onSelect, onToggleExclude, onDelete }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
    {files.map(f => (
      <div
        key={`${f.prefix}/${f.name}`}
        onClick={() => onSelect(f)}
        className={`group relative flex flex-col items-center gap-1.5 p-3 rounded-lg border cursor-pointer transition-colors ${
          selectedFile?.name === f.name && selectedFile?.type === f.prefix
            ? 'bg-neutral-700/50 border-neutral-500'
            : f.excluded ? 'bg-neutral-900/50 border-neutral-800' : 'bg-neutral-800/50 border-neutral-700 hover:border-neutral-600'
        }`}
      >
        <div className="absolute top-1.5 left-1.5">
          <FileCheckbox excluded={f.excluded} onToggle={e => { e.stopPropagation(); onToggleExclude(f) }} />
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(f) }}
          className="absolute top-1.5 right-1.5 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete file"
        >
          <Trash2 className="h-3 w-3" />
        </button>
        <FileIcon prefix={f.prefix} className="h-6 w-6" />
        <span className={`text-xs text-center truncate w-full ${f.excluded ? 'text-neutral-600 line-through' : 'text-neutral-300'}`}>
          {f.name}
        </span>
        <span className="text-[10px] text-neutral-600">{f.prefix === 'attachments' ? 'attached' : 'agent'}</span>
      </div>
    ))}
  </div>
)

// --- Tree View ---
const FileTreeView: FC<{
  agentFiles: FileEntry[]
  attachmentFiles: FileEntry[]
  selectedFile: { name: string; type: string } | null
  onSelect: (f: FileEntry) => void
  onToggleExclude: (f: FileEntry) => void
  onDelete: (f: FileEntry) => void
}> = ({ agentFiles, attachmentFiles, selectedFile, onSelect, onToggleExclude, onDelete }) => {
  const [agentExpanded, setAgentExpanded] = useState(true)
  const [attachExpanded, setAttachExpanded] = useState(true)

  const renderGroup = (label: string, files: FileEntry[], expanded: boolean, toggle: () => void) => (
    <div>
      <button onClick={toggle} className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-300 py-1 w-full">
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <FolderOpen className="h-3 w-3 text-yellow-600" />
        <span className="font-medium">{label}/</span>
        <span className="text-neutral-600 ml-1">({files.length})</span>
      </button>
      {expanded && (
        <div className="ml-4 border-l border-neutral-800">
          {files.length === 0 ? (
            <p className="text-neutral-600 text-xs pl-3 py-1 italic">empty</p>
          ) : files.map(f => (
            <div
              key={`${f.prefix}/${f.name}`}
              onClick={() => onSelect(f)}
              className={`group flex items-center gap-2 pl-3 pr-2 py-1 cursor-pointer transition-colors ${
                selectedFile?.name === f.name && selectedFile?.type === f.prefix
                  ? 'bg-neutral-700/30'
                  : 'hover:bg-neutral-800/50'
              }`}
            >
              <FileCheckbox excluded={f.excluded} onToggle={e => { e.stopPropagation(); onToggleExclude(f) }} />
              <FileIcon prefix={f.prefix} className="h-3 w-3" />
              <span className={`flex-1 text-xs truncate ${f.excluded ? 'text-neutral-600 line-through' : 'text-neutral-300'}`}>
                {f.name}
              </span>
              <button
                onClick={e => { e.stopPropagation(); onDelete(f) }}
                className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                title="Delete file"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="border border-neutral-700 rounded-md p-2 space-y-1">
      {renderGroup('attachments', attachmentFiles, attachExpanded, () => setAttachExpanded(p => !p))}
      {renderGroup('agent', agentFiles, agentExpanded, () => setAgentExpanded(p => !p))}
    </div>
  )
}

const TaskFilesTab: FC<{ taskId: string }> = ({ taskId }) => {
  const { tasks, settings, updateSettings } = useAIAutomation()
  const task = tasks.find(t => t.id === taskId)
  const [agentFiles, setAgentFiles] = useState<string[]>([])
  const [attachments, setAttachments] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState<{ name: string; type: 'agent' | 'attachments' } | null>(null)
  const [content, setContent] = useState('')
  const [viewMode, setViewMode] = useState<FileViewMode>(settings?.fileViewMode || 'list')

  const persistViewMode = (mode: FileViewMode) => {
    setViewMode(mode)
    updateSettings({ fileViewMode: mode })
  }
  const excluded = task?.excludedFiles || []

  const loadFiles = () => {
    window.electron.aiGetTaskFiles(taskId).then(setAgentFiles)
    window.electron.aiListTaskAttachments(taskId).then(setAttachments)
  }

  useEffect(() => { loadFiles() }, [taskId])

  useEffect(() => {
    if (selectedFile) {
      if (selectedFile.type === 'agent') {
        window.electron.aiReadTaskFile(taskId, selectedFile.name).then(setContent)
      } else {
        setContent('(Attachment — preview not available)')
      }
    }
  }, [taskId, selectedFile])

  const isExcluded = (prefix: string, filename: string) => excluded.includes(`${prefix}/${filename}`)

  const agentEntries: FileEntry[] = agentFiles.map(f => ({ name: f, prefix: 'agent', excluded: isExcluded('agent', f) }))
  const attachEntries: FileEntry[] = attachments.map(f => ({ name: f, prefix: 'attachments', excluded: isExcluded('attachments', f) }))
  const allFiles = [...attachEntries, ...agentEntries]

  const handleSelect = (f: FileEntry) => setSelectedFile({ name: f.name, type: f.prefix })
  const handleToggleExclude = async (f: FileEntry) => {
    await window.electron.aiToggleFileExclusion(taskId, `${f.prefix}/${f.name}`)
  }
  const handleDelete = async (f: FileEntry) => {
    if (f.prefix === 'attachments') {
      await window.electron.aiDeleteTaskAttachment(taskId, f.name)
    } else {
      await window.electron.aiDeleteAgentFile(taskId, f.name)
    }
    if (selectedFile?.name === f.name && selectedFile?.type === f.prefix) {
      setSelectedFile(null)
      setContent('')
    }
    loadFiles()
  }

  return (
    <div className="space-y-3">
      {/* Header: description + view toggle + attach button */}
      <div className="flex items-start justify-between gap-4">
        <p className="text-neutral-500 text-xs leading-relaxed flex-1">
          Files are included in agent prompts by default. Uncheck to exclude. Higher-numbered files supersede earlier versions.
        </p>
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="flex border border-neutral-700 rounded-md overflow-hidden">
            {([['list', List], ['grid', LayoutGrid], ['tree', FolderTree]] as const).map(([mode, Icon]) => (
              <button
                key={mode}
                onClick={() => persistViewMode(mode)}
                className={`p-1.5 transition-colors ${viewMode === mode ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'}`}
                title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} view`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs ml-2" onClick={async () => {
            const selected = await window.electron.aiSelectFiles()
            if (selected && selected.length > 0) {
              await window.electron.aiAttachTaskFiles(taskId, selected)
              loadFiles()
            }
          }}>
            <Paperclip className="h-3 w-3 mr-1" /> Attach
          </Button>
        </div>
      </div>

      {/* File views */}
      {allFiles.length === 0 ? (
        <div className="text-center py-8 text-neutral-600 text-xs">
          <FileText className="h-8 w-8 mx-auto mb-2 text-neutral-700" />
          <p>No files yet. Agents will create files during execution.</p>
          <p className="mt-1">Click "Attach" to add reference files.</p>
        </div>
      ) : (
        <>
          {viewMode === 'list' && (
            <FileListView files={allFiles} selectedFile={selectedFile} onSelect={handleSelect} onToggleExclude={handleToggleExclude} onDelete={handleDelete} />
          )}
          {viewMode === 'grid' && (
            <FileGridView files={allFiles} selectedFile={selectedFile} onSelect={handleSelect} onToggleExclude={handleToggleExclude} onDelete={handleDelete} />
          )}
          {viewMode === 'tree' && (
            <FileTreeView agentFiles={agentEntries} attachmentFiles={attachEntries} selectedFile={selectedFile} onSelect={handleSelect} onToggleExclude={handleToggleExclude} onDelete={handleDelete} />
          )}
        </>
      )}

      {/* File preview */}
      {selectedFile?.type === 'agent' && content && (
        <pre className="whitespace-pre-wrap text-sm text-neutral-300 font-mono bg-neutral-900 p-4 rounded border border-neutral-800 max-h-[500px] overflow-y-auto">
          {content || 'Empty file'}
        </pre>
      )}
    </div>
  )
}

const AttachmentsInline: FC<{ taskId: string }> = ({ taskId }) => {
  const [attachments, setAttachments] = useState<string[]>([])

  const loadAttachments = () => {
    window.electron.aiListTaskAttachments(taskId).then(setAttachments)
  }

  useEffect(() => { loadAttachments() }, [taskId])

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Attachments</h3>
        <Button variant="outline" size="sm" className="h-6 text-xs" onClick={async () => {
          const selected = await window.electron.aiSelectFiles()
          if (selected && selected.length > 0) {
            await window.electron.aiAttachTaskFiles(taskId, selected)
            loadAttachments()
          }
        }}>
          <Paperclip className="h-3 w-3 mr-1" /> Attach
        </Button>
      </div>
      {attachments.length > 0 && (
        <div className="flex gap-2 flex-wrap mt-1">
          {attachments.map(f => (
            <div key={f} className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-xs text-neutral-300">
              <Paperclip className="h-3 w-3 text-neutral-500" />
              {f}
              <button
                onClick={async () => {
                  await window.electron.aiDeleteTaskAttachment(taskId, f)
                  loadAttachments()
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
  )
}

export const AITaskDetail: FC<AITaskDetailProps> = ({ taskId, onBack }) => {
  const { tasks, stopTask, moveTaskPhase, updateTask, settings, updateSettings } = useAIAutomation()
  const task = tasks.find(t => t.id === taskId)
  const [reviewComments, setReviewCommentsLocal] = useState<AIHumanComment[]>([])

  const setReviewComments = (comments: AIHumanComment[]) => {
    setReviewCommentsLocal(comments)
    if (task) {
      updateTask(task.id, { humanComments: comments })
    }
  }

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editProjects, setEditProjects] = useState<AITaskProject[]>([])
  const editDescRef = useRef<MentionEditorHandle>(null)

  const pipeline = settings?.pipeline || []
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
    setTimeout(() => {
      editDescRef.current?.hydrateText(task.description, labels)
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

  // Load existing comments when task changes
  useEffect(() => {
    if (task?.humanComments) {
      setReviewCommentsLocal(task.humanComments)
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
  const [showRequestChanges, setShowRequestChanges] = useState(false)
  const [generalComment, setGeneralComment] = useState('')

  const handleRequestChanges = async () => {
    let allComments = [...reviewComments]
    if (generalComment.trim()) {
      allComments.push({
        file: '',
        line: 0,
        comment: generalComment.trim(),
        createdAt: new Date().toISOString()
      })
    }
    await updateTask(task.id, { humanComments: allComments })
    setGeneralComment('')
    setShowRequestChanges(false)
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
              <button
                onClick={() => navigator.clipboard.writeText(task.id)}
                className="text-[10px] font-mono text-neutral-600 hover:text-neutral-400 transition-colors"
                title="Click to copy task ID"
              >
                {task.id.slice(0, 8)}
              </button>
              <button
                onClick={() => window.electron.aiOpenTaskDir(task.id)}
                className="text-neutral-600 hover:text-neutral-400 transition-colors"
                title="Open task directory"
              >
                <FolderOpen className="h-3 w-3" />
              </button>
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
            <div className="relative flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRequestChanges(prev => !prev)}
              >
                <XCircle className="h-3 w-3 mr-1" />
                Request Changes
                {reviewComments.filter(c => !c.resolved).length > 0 && (
                  <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-900/50 text-amber-300">
                    {reviewComments.filter(c => !c.resolved).length}
                  </span>
                )}
              </Button>
              {showRequestChanges && (
                <div className="absolute top-full right-0 mt-2 w-80 z-50 rounded-lg border border-neutral-700 bg-neutral-800 shadow-xl p-3 space-y-3">
                  <h4 className="text-xs font-medium text-neutral-300">General Feedback</h4>
                  <textarea
                    value={generalComment}
                    onChange={e => setGeneralComment(e.target.value)}
                    placeholder="Add overall feedback (optional)..."
                    className="w-full min-h-[80px] rounded-md border border-neutral-600 bg-neutral-900 px-3 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 resize-y"
                    rows={3}
                    autoFocus
                  />
                  <div className="text-[10px] text-neutral-500">
                    {reviewComments.filter(c => !c.resolved).length} unresolved inline comment{reviewComments.filter(c => !c.resolved).length !== 1 ? 's' : ''} will also be sent
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
              <Button size="sm" onClick={handleApprove}>
                <CheckCircle className="h-3 w-3 mr-1" />
                Approve
              </Button>
            </div>
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
          {task.projects && task.projects.length > 0 && (
            <span className="ml-auto text-xs text-neutral-500 truncate max-w-[200px]">
              in {task.projects[0].label}
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
          {task.worktrees && task.worktrees.length > 0 && (
            <TabsTrigger value="devcontrol">Dev Control</TabsTrigger>
          )}
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
                <MentionEditor
                  ref={editDescRef}
                  placeholder="Describe what needs to be done... Type @ to tag a project"
                  className="mt-1"
                  minHeight="120px"
                  excludeProjectPaths={new Set(editProjects.map(p => p.path))}
                  onProjectTagged={(dir) => {
                    if (!editProjects.some(p => p.path === dir.path)) {
                      setEditProjects(prev => [...prev, {
                        path: dir.path,
                        label: dir.customLabel || dir.name,
                        gitStrategy: settings?.defaultGitStrategy === 'none' ? 'none' : 'worktree',
                        baseBranch: settings?.defaultBaseBranch ?? 'main'
                      }])
                    }
                  }}
                />
              ) : (
                task.description && <p className="mt-1 text-sm text-neutral-300 whitespace-pre-wrap">{renderMentions(task.description, new Set((task.projects || []).map(p => p.label)))}</p>
              )}
            </div>
            <div>
              <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Projects</h3>
              {editing ? (
                <div className="mt-1 space-y-2">
                  {editProjects.map((proj, i) => (
                    <div key={i} className="rounded-md border border-neutral-700 bg-neutral-800/50 p-2">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <FolderOpen className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                            <span className="text-sm text-blue-300 truncate">{proj.label}</span>
                          </div>
                          <p className="text-[11px] text-neutral-500 truncate ml-5">{proj.path}</p>
                        </div>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0" onClick={() => setEditProjects(prev => prev.filter((_, j) => j !== i))}>
                          <X className="h-3 w-3 text-red-400" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select value={proj.gitStrategy} onValueChange={v => setEditProjects(prev => prev.map((p, j) => j === i ? { ...p, gitStrategy: v as AIGitStrategy } : p))}>
                          <SelectTrigger className="h-7 w-[110px] text-xs flex-shrink-0"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="worktree">Worktree</SelectItem>
                            <SelectItem value="none">Read Only</SelectItem>
                          </SelectContent>
                        </Select>
                        {proj.gitStrategy === 'worktree' && (
                          <>
                            <Input
                              value={proj.customBranchName || ''}
                              onChange={e => setEditProjects(prev => prev.map((p, j) => j === i ? { ...p, customBranchName: e.target.value || undefined } : p))}
                              placeholder="Branch (auto)"
                              className="h-7 text-xs flex-1 min-w-0"
                            />
                            <Input
                              value={proj.baseBranch || ''}
                              onChange={e => setEditProjects(prev => prev.map((p, j) => j === i ? { ...p, baseBranch: e.target.value || undefined } : p))}
                              placeholder="Base"
                              className="h-7 text-xs w-[90px] flex-shrink-0"
                            />
                          </>
                        )}
                        {proj.gitStrategy === 'none' && (
                          <span className="text-[11px] text-neutral-500 italic">Read only</span>
                        )}
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={async () => {
                    const selected = await window.electron.aiSelectDirectory()
                    if (selected && !editProjects.some(p => p.path === selected)) {
                      setEditProjects(prev => [...prev, { path: selected, label: selected.split('/').pop() || selected, gitStrategy: 'worktree', baseBranch: 'main' }])
                    }
                  }}>
                    <Plus className="h-3 w-3 mr-1" /> Add Project
                  </Button>
                </div>
              ) : (
                task.projects && task.projects.length > 0 ? (
                  <div className="mt-1 space-y-1">
                    {task.projects.map((proj, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-neutral-300">
                        <FolderOpen className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                        <span className="font-medium">{proj.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${proj.gitStrategy === 'worktree' ? 'bg-blue-900/50 text-blue-300' : 'bg-neutral-700 text-neutral-400'}`}>
                          {proj.gitStrategy === 'worktree' ? 'worktree' : 'read only'}
                        </span>
                        {proj.gitStrategy === 'worktree' && proj.baseBranch && (
                          <span className="text-xs text-neutral-500">base: {proj.baseBranch}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-neutral-500">No projects tagged</p>
                )
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
            {/* Attachments */}
            <AttachmentsInline taskId={task.id} />
            {task.humanComments && task.humanComments.length > 0 && !isManualPhase && (
              <div>
                <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Previous Review Comments</h3>
                <div className="mt-1 space-y-1">
                  {task.humanComments.map((c, i) => (
                    <div key={i} className={`flex items-start gap-2 text-sm p-2 rounded border ${
                      c.resolved ? 'bg-neutral-800/30 border-neutral-700/40' : 'bg-amber-900/10 border-amber-900/20'
                    }`}>
                      <MessageSquare className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${c.resolved ? 'text-neutral-600' : 'text-amber-400'}`} />
                      <div className="min-w-0 flex-1">
                        {c.file ? (
                          <span className={`text-xs font-mono ${c.resolved ? 'text-neutral-600' : 'text-neutral-500'}`}>{c.file}:{c.line}</span>
                        ) : (
                          <span className={`text-xs font-medium ${c.resolved ? 'text-neutral-600' : 'text-amber-400/70'}`}>General</span>
                        )}
                        <p className={`text-xs mt-0.5 ${c.resolved ? 'text-neutral-600 line-through' : 'text-neutral-300'}`}>{c.comment}</p>
                      </div>
                      {c.resolved && <span className="text-[10px] text-green-600 shrink-0">resolved</span>}
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
