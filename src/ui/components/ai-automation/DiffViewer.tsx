import { useState, useEffect, useMemo, useRef, useCallback, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { Columns2, Rows3, FileCode, ChevronRight, ChevronDown, Plus, X, MessageSquare, AlertTriangle, Check, CircleCheck, FolderOpen, PanelLeftClose, PanelLeft } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'

const LARGE_DIFF_THRESHOLD = 200 // lines changed

interface DiffViewerProps {
  taskId: string
  comments: AIHumanComment[]
  onCommentsChange: (comments: AIHumanComment[]) => void
  readOnly?: boolean
  settings?: AIAutomationSettings
  onUpdateSettings?: (updates: Partial<AIAutomationSettings>) => void
}

type ViewMode = 'unified' | 'split'

interface DiffLine {
  type: 'added' | 'removed' | 'context' | 'header'
  content: string
  oldLineNum?: number
  newLineNum?: number
}

interface DiffHunk {
  header: string
  lines: DiffLine[]
}

interface DiffFile {
  oldPath: string
  newPath: string
  isNew: boolean
  isDeleted: boolean
  hunks: DiffHunk[]
}

function parseDiff(raw: string): DiffFile[] {
  const files: DiffFile[] = []
  const lines = raw.split('\n')
  let i = 0

  while (i < lines.length) {
    if (!lines[i].startsWith('diff --git')) { i++; continue }

    const diffLine = lines[i]
    const pathMatch = diffLine.match(/diff --git a\/(.+?) b\/(.+)/)
    const oldPath = pathMatch?.[1] ?? ''
    const newPath = pathMatch?.[2] ?? ''
    i++

    let isNew = false
    let isDeleted = false

    while (i < lines.length && !lines[i].startsWith('diff --git') && !lines[i].startsWith('---') && !lines[i].startsWith('@@')) {
      if (lines[i].startsWith('new file')) isNew = true
      if (lines[i].startsWith('deleted file')) isDeleted = true
      i++
    }

    if (i < lines.length && lines[i].startsWith('---')) i++
    if (i < lines.length && lines[i].startsWith('+++')) i++

    const hunks: DiffHunk[] = []

    while (i < lines.length && !lines[i].startsWith('diff --git')) {
      if (lines[i].startsWith('@@')) {
        const header = lines[i]
        const hunkMatch = header.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
        let oldLine = hunkMatch ? parseInt(hunkMatch[1]) : 1
        let newLine = hunkMatch ? parseInt(hunkMatch[2]) : 1
        i++

        const hunkLines: DiffLine[] = []
        while (i < lines.length && !lines[i].startsWith('@@') && !lines[i].startsWith('diff --git')) {
          const line = lines[i]
          if (line.startsWith('+')) {
            hunkLines.push({ type: 'added', content: line.slice(1), newLineNum: newLine })
            newLine++
          } else if (line.startsWith('-')) {
            hunkLines.push({ type: 'removed', content: line.slice(1), oldLineNum: oldLine })
            oldLine++
          } else if (line.startsWith(' ') || line === '') {
            hunkLines.push({ type: 'context', content: line.startsWith(' ') ? line.slice(1) : line, oldLineNum: oldLine, newLineNum: newLine })
            oldLine++
            newLine++
          } else {
            i++
            continue
          }
          i++
        }
        hunks.push({ header, lines: hunkLines })
      } else {
        i++
      }
    }

    files.push({ oldPath, newPath, isNew, isDeleted, hunks })
  }

  return files
}

function getFileStats(file: DiffFile): { added: number; removed: number } {
  let added = 0, removed = 0
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'added') added++
      if (line.type === 'removed') removed++
    }
  }
  return { added, removed }
}

// Comment key for looking up comments by file + line
function commentKey(file: string, line: number): string {
  return `${file}:${line}`
}

// Inline comment display
const InlineComment: FC<{
  comment: AIHumanComment
  onDelete?: () => void
  onToggleResolved?: () => void
}> = ({ comment, onDelete, onToggleResolved }) => (
  <div className={`flex items-start gap-2 mx-2 my-1 p-2 rounded border ${
    comment.resolved
      ? 'bg-neutral-800/30 border-neutral-700/40'
      : 'bg-amber-900/20 border-amber-700/40'
  }`}>
    <MessageSquare className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${comment.resolved ? 'text-neutral-600' : 'text-amber-400'}`} />
    <p className={`text-xs flex-1 whitespace-pre-wrap ${comment.resolved ? 'text-neutral-600 line-through' : 'text-amber-200'}`}>{comment.comment}</p>
    {onToggleResolved && (
      <button
        onClick={onToggleResolved}
        className={`shrink-0 ${comment.resolved ? 'text-green-500 hover:text-green-400' : 'text-neutral-500 hover:text-green-400'}`}
        title={comment.resolved ? 'Mark as unresolved' : 'Mark as resolved'}
      >
        <CircleCheck className="h-3.5 w-3.5" />
      </button>
    )}
    {onDelete && (
      <button onClick={onDelete} className="text-neutral-500 hover:text-neutral-300 shrink-0">
        <X className="h-3 w-3" />
      </button>
    )}
  </div>
)

// Comment input form
const CommentInput: FC<{
  onSubmit: (text: string) => void
  onCancel: () => void
}> = ({ onSubmit, onCancel }) => {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <div className="mx-2 my-1 p-2 rounded bg-neutral-800 border border-neutral-600">
      <textarea
        ref={ref}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim()) {
            onSubmit(text.trim())
          } else if (e.key === 'Escape') {
            onCancel()
          }
        }}
        placeholder="Add a comment... (Ctrl+Enter to submit, Esc to cancel)"
        className="w-full min-h-[60px] bg-transparent text-xs text-white placeholder:text-neutral-500 outline-none resize-y"
        rows={2}
      />
      <div className="flex justify-end gap-1 mt-1">
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" className="h-6 px-2 text-xs" disabled={!text.trim()} onClick={() => onSubmit(text.trim())}>
          Comment
        </Button>
      </div>
    </div>
  )
}

// A single diff line row with comment gutter button
const DiffLineRow: FC<{
  line: DiffLine
  filePath: string
  commentMap: Map<string, AIHumanComment[]>
  activeComment: string | null
  onStartComment: (key: string) => void
  onSubmitComment: (file: string, lineNum: number, text: string) => void
  onCancelComment: () => void
  onDeleteComment: (file: string, line: number) => void
  onToggleResolved: (file: string, line: number) => void
  readOnly: boolean
  children: React.ReactNode
}> = ({ line, filePath, commentMap, activeComment, onStartComment, onSubmitComment, onCancelComment, onDeleteComment, onToggleResolved, readOnly, children }) => {
  const lineNum = line.newLineNum ?? line.oldLineNum
  const key = lineNum !== undefined ? commentKey(filePath, lineNum) : null
  const lineComments = key ? (commentMap.get(key) || []) : []
  const isActive = key !== null && activeComment === key

  return (
    <>
      <div className={`flex group ${
        line.type === 'added' ? 'bg-green-900/20' :
        line.type === 'removed' ? 'bg-red-900/20' : ''
      }`}>
        {/* Comment gutter */}
        {!readOnly && lineNum !== undefined ? (
          <button
            className="w-5 shrink-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-blue-400 hover:text-blue-300"
            onClick={() => key && onStartComment(key)}
          >
            <Plus className="h-3 w-3" />
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}
        {children}
      </div>
      {/* Existing comments on this line */}
      {lineComments.map((c, ci) => (
        <InlineComment
          key={ci}
          comment={c}
          onDelete={readOnly ? undefined : () => onDeleteComment(c.file, c.line)}
          onToggleResolved={readOnly ? undefined : () => onToggleResolved(c.file, c.line)}
        />
      ))}
      {/* Active comment input */}
      {isActive && lineNum !== undefined && (
        <CommentInput
          onSubmit={text => onSubmitComment(filePath, lineNum, text)}
          onCancel={onCancelComment}
        />
      )}
    </>
  )
}

const UnifiedView: FC<{
  file: DiffFile
  commentMap: Map<string, AIHumanComment[]>
  activeComment: string | null
  onStartComment: (key: string) => void
  onSubmitComment: (file: string, line: number, text: string) => void
  onCancelComment: () => void
  onDeleteComment: (file: string, line: number) => void
  onToggleResolved: (file: string, line: number) => void
  readOnly: boolean
}> = ({ file, commentMap, activeComment, onStartComment, onSubmitComment, onCancelComment, onDeleteComment, onToggleResolved, readOnly }) => {
  const filePath = file.newPath || file.oldPath
  return (
    <div className="font-mono text-xs leading-5">
      {file.hunks.map((hunk, hi) => (
        <div key={hi}>
          <div className="bg-blue-900/20 text-blue-300 px-4 py-0.5 select-none border-y border-neutral-800">
            {hunk.header}
          </div>
          {hunk.lines.map((line, li) => (
            <DiffLineRow
              key={li}
              line={line}
              filePath={filePath}
              commentMap={commentMap}
              activeComment={activeComment}
              onStartComment={onStartComment}
              onSubmitComment={onSubmitComment}
              onCancelComment={onCancelComment}
              onDeleteComment={onDeleteComment}
              onToggleResolved={onToggleResolved}
              readOnly={readOnly}
            >
              <span className="w-12 text-right pr-2 text-neutral-600 select-none shrink-0 border-r border-neutral-800">
                {line.oldLineNum ?? ''}
              </span>
              <span className="w-12 text-right pr-2 text-neutral-600 select-none shrink-0 border-r border-neutral-800">
                {line.newLineNum ?? ''}
              </span>
              <span className={`w-4 text-center select-none shrink-0 ${
                line.type === 'added' ? 'text-green-400' :
                line.type === 'removed' ? 'text-red-400' : 'text-neutral-600'
              }`}>
                {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
              </span>
              <span className="flex-1 px-2 whitespace-pre overflow-x-auto">{line.content}</span>
            </DiffLineRow>
          ))}
        </div>
      ))}
    </div>
  )
}

function buildSplitPairs(lines: DiffLine[]): Array<{ left: DiffLine | null; right: DiffLine | null }> {
  const pairs: Array<{ left: DiffLine | null; right: DiffLine | null }> = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.type === 'context') {
      pairs.push({ left: line, right: line })
      i++
    } else if (line.type === 'removed') {
      const removed: DiffLine[] = []
      while (i < lines.length && lines[i].type === 'removed') {
        removed.push(lines[i])
        i++
      }
      const added: DiffLine[] = []
      while (i < lines.length && lines[i].type === 'added') {
        added.push(lines[i])
        i++
      }
      const max = Math.max(removed.length, added.length)
      for (let j = 0; j < max; j++) {
        pairs.push({
          left: j < removed.length ? removed[j] : null,
          right: j < added.length ? added[j] : null
        })
      }
    } else if (line.type === 'added') {
      pairs.push({ left: null, right: line })
      i++
    } else {
      i++
    }
  }
  return pairs
}

const SplitView: FC<{
  file: DiffFile
  commentMap: Map<string, AIHumanComment[]>
  activeComment: string | null
  onStartComment: (key: string) => void
  onSubmitComment: (file: string, line: number, text: string) => void
  onCancelComment: () => void
  onDeleteComment: (file: string, line: number) => void
  onToggleResolved: (file: string, line: number) => void
  readOnly: boolean
}> = ({ file, commentMap, activeComment, onStartComment, onSubmitComment, onCancelComment, onDeleteComment, onToggleResolved, readOnly }) => {
  const filePath = file.newPath || file.oldPath
  return (
    <div className="font-mono text-xs leading-5">
      {file.hunks.map((hunk, hi) => {
        const pairs = buildSplitPairs(hunk.lines)
        return (
          <div key={hi}>
            <div className="bg-blue-900/20 text-blue-300 px-4 py-0.5 select-none border-y border-neutral-800">
              {hunk.header}
            </div>
            {pairs.map((pair, pi) => {
              // For comments in split view, use the right (new) side line number
              const commentLine = pair.right ?? pair.left
              const lineNum = commentLine?.newLineNum ?? commentLine?.oldLineNum
              const key = lineNum !== undefined ? commentKey(filePath, lineNum) : null
              const lineComments = key ? (commentMap.get(key) || []) : []
              const isActive = key !== null && activeComment === key

              return (
                <div key={pi}>
                  <div className="flex group">
                    {/* Left side */}
                    {pair.left ? (
                      <div className={`flex-1 flex min-w-0 ${pair.left.type === 'removed' ? 'bg-red-900/20' : ''}`}>
                        <span className="w-12 text-right pr-2 text-neutral-600 select-none shrink-0 border-r border-neutral-800">
                          {pair.left.oldLineNum ?? ''}
                        </span>
                        <span className={`w-4 text-center select-none shrink-0 ${pair.left.type === 'removed' ? 'text-red-400' : 'text-neutral-600'}`}>
                          {pair.left.type === 'removed' ? '-' : ' '}
                        </span>
                        <span className="flex-1 px-2 whitespace-pre overflow-x-auto">{pair.left.content}</span>
                      </div>
                    ) : (
                      <div className="flex-1 bg-neutral-900/50 min-w-0" />
                    )}
                    <div className="w-px bg-neutral-700 shrink-0" />
                    {/* Right side */}
                    {pair.right ? (
                      <div className={`flex-1 flex min-w-0 ${pair.right.type === 'added' ? 'bg-green-900/20' : ''}`}>
                        {!readOnly && lineNum !== undefined ? (
                          <button
                            className="w-5 shrink-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-blue-400 hover:text-blue-300"
                            onClick={() => key && onStartComment(key)}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        ) : (
                          <span className="w-5 shrink-0" />
                        )}
                        <span className="w-12 text-right pr-2 text-neutral-600 select-none shrink-0 border-r border-neutral-800">
                          {pair.right.newLineNum ?? ''}
                        </span>
                        <span className={`w-4 text-center select-none shrink-0 ${pair.right.type === 'added' ? 'text-green-400' : 'text-neutral-600'}`}>
                          {pair.right.type === 'added' ? '+' : ' '}
                        </span>
                        <span className="flex-1 px-2 whitespace-pre overflow-x-auto">{pair.right.content}</span>
                      </div>
                    ) : (
                      <div className="flex-1 bg-neutral-900/50 min-w-0" />
                    )}
                  </div>
                  {/* Comments below the pair */}
                  {lineComments.map((c, ci) => (
                    <InlineComment
                      key={ci}
                      comment={c}
                      onDelete={readOnly ? undefined : () => onDeleteComment(c.file, c.line)}
                      onToggleResolved={readOnly ? undefined : () => onToggleResolved(c.file, c.line)}
                    />
                  ))}
                  {isActive && lineNum !== undefined && (
                    <CommentInput
                      onSubmit={text => onSubmitComment(filePath, lineNum, text)}
                      onCancel={onCancelComment}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

interface ProjectFileGroup {
  project: string
  projectPath: string
  files: DiffFile[]
}

export const DiffViewer: FC<DiffViewerProps> = ({ taskId, comments, onCommentsChange, readOnly = false, settings, onUpdateSettings }) => {
  const [projectDiffs, setProjectDiffs] = useState<AIProjectDiff[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>(settings?.diffViewMode || 'unified')
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set())
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set())
  const [forcedLargeFiles, setForcedLargeFiles] = useState<Set<string>>(new Set())
  const [activeComment, setActiveComment] = useState<string | null>(null)
  const [showResolved, setShowResolved] = useState(settings?.showResolvedComments ?? true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarCollapsedProjects, setSidebarCollapsedProjects] = useState<Set<string>>(new Set())
  const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const setFileRef = useCallback((path: string, el: HTMLDivElement | null) => {
    if (el) fileRefs.current.set(path, el)
    else fileRefs.current.delete(path)
  }, [])

  const persistViewMode = (mode: ViewMode) => {
    setViewMode(mode)
    onUpdateSettings?.({ diffViewMode: mode })
  }

  const persistShowResolved = (show: boolean) => {
    setShowResolved(show)
    onUpdateSettings?.({ showResolvedComments: show })
  }

  useEffect(() => {
    setLoading(true)
    window.electron.aiGetTaskDiff(taskId).then(diffs => {
      setProjectDiffs(diffs)
      setLoading(false)
    })
  }, [taskId])

  const projectGroups: ProjectFileGroup[] = useMemo(() =>
    projectDiffs.map(pd => ({
      project: pd.project,
      projectPath: pd.path,
      files: parseDiff(pd.diff)
    }))
  , [projectDiffs])

  const scrollToFile = useCallback((filePath: string) => {
    const el = fileRefs.current.get(filePath)
    if (el) {
      setCollapsedFiles(prev => {
        if (prev.has(filePath)) {
          const next = new Set(prev)
          next.delete(filePath)
          return next
        }
        return prev
      })
      for (const g of projectGroups) {
        if (g.files.some(f => (f.newPath || f.oldPath) === filePath)) {
          setCollapsedProjects(prev => {
            if (prev.has(g.project)) {
              const next = new Set(prev)
              next.delete(g.project)
              return next
            }
            return prev
          })
          break
        }
      }
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }
  }, [projectGroups])

  const files = useMemo(() => projectGroups.flatMap(g => g.files), [projectGroups])
  const multiProject = projectGroups.length > 1

  const resolvedCount = comments.filter(c => c.resolved).length

  // Collect all line numbers present in the current diff per file
  const diffLinesByFile = useMemo(() => {
    const map = new Map<string, Set<number>>()
    for (const file of files) {
      const filePath = file.newPath || file.oldPath
      const lineSet = new Set<number>()
      for (const hunk of file.hunks) {
        for (const line of hunk.lines) {
          if (line.newLineNum !== undefined) lineSet.add(line.newLineNum)
          if (line.oldLineNum !== undefined) lineSet.add(line.oldLineNum)
        }
      }
      map.set(filePath, lineSet)
    }
    return map
  }, [files])

  // Build comment lookup map: "file:line" -> comments[] (line-specific only)
  const commentMap = useMemo(() => {
    const map = new Map<string, AIHumanComment[]>()
    for (const c of comments) {
      if (!c.file) continue // skip general comments
      if (!showResolved && c.resolved) continue
      const key = commentKey(c.file, c.line)
      const arr = map.get(key) || []
      arr.push(c)
      map.set(key, arr)
    }
    return map
  }, [comments, showResolved])

  // Detect orphaned comments: line-specific comments on files not in the diff at all
  const orphanedComments = useMemo(() => {
    const fileSet = new Set(files.map(f => f.newPath || f.oldPath))
    return comments.filter(c => {
      if (!c.file) return false
      if (!showResolved && c.resolved) return false
      return !fileSet.has(c.file)
    })
  }, [comments, files, showResolved])

  // Group orphaned by file
  const orphanedByFile = useMemo(() => {
    const map = new Map<string, AIHumanComment[]>()
    for (const c of orphanedComments) {
      const arr = map.get(c.file) || []
      arr.push(c)
      map.set(c.file, arr)
    }
    return map
  }, [orphanedComments])

  const handleResolveOrphanedFile = (file: string) => {
    const fileSet = new Set(files.map(f => f.newPath || f.oldPath))
    onCommentsChange(comments.map(c =>
      c.file === file && !c.resolved && !fileSet.has(file) ? { ...c, resolved: true } : c
    ))
  }

  const handleResolveAllOrphaned = () => {
    const fileSet = new Set(files.map(f => f.newPath || f.oldPath))
    onCommentsChange(comments.map(c =>
      c.file && !c.resolved && !fileSet.has(c.file) ? { ...c, resolved: true } : c
    ))
  }

  const handleSubmitComment = (file: string, line: number, text: string) => {
    const newComment: AIHumanComment = {
      file,
      line,
      comment: text,
      createdAt: new Date().toISOString()
    }
    onCommentsChange([...comments, newComment])
    setActiveComment(null)
  }

  const handleDeleteComment = (file: string, line: number) => {
    onCommentsChange(comments.filter(c => !(c.file === file && c.line === line)))
  }

  const handleToggleResolved = (file: string, line: number) => {
    onCommentsChange(comments.map(c =>
      c.file === file && c.line === line ? { ...c, resolved: !c.resolved } : c
    ))
  }

  const toggleFile = (path: string) => {
    setCollapsedFiles(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const totalStats = useMemo(() => {
    let added = 0, removed = 0
    for (const f of files) {
      const s = getFileStats(f)
      added += s.added
      removed += s.removed
    }
    return { added, removed }
  }, [files])

  if (loading) {
    return <div className="h-full flex items-center justify-center text-neutral-500 text-sm">Loading diff...</div>
  }

  if (projectDiffs.length === 0 || files.length === 0) {
    return <div className="h-full flex items-center justify-center text-neutral-500 text-sm">No changes to display</div>
  }

  const toggleProject = (project: string) => {
    setCollapsedProjects(prev => {
      const next = new Set(prev)
      if (next.has(project)) next.delete(project)
      else next.add(project)
      return next
    })
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-1 pb-3 shrink-0">
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-neutral-400"
            onClick={() => setSidebarOpen(prev => !prev)}
            title={sidebarOpen ? 'Hide file tree' : 'Show file tree'}
          >
            {sidebarOpen ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeft className="h-3.5 w-3.5" />}
          </Button>
          {files.length} file{files.length !== 1 ? 's' : ''} changed
          <span className="text-green-400 ml-2">+{totalStats.added}</span>
          <span className="text-red-400 ml-1">-{totalStats.removed}</span>
          {comments.length > 0 && (
            <span className="text-amber-400 ml-3">
              <MessageSquare className="h-3 w-3 inline mr-1" />
              {comments.length} comment{comments.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {resolvedCount > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={showResolved}
                onCheckedChange={(checked) => persistShowResolved(!!checked)}
              />
              <span className="text-xs text-neutral-400">Show resolved ({resolvedCount})</span>
            </label>
          )}
          <div className="flex items-center gap-1 bg-neutral-800 rounded p-0.5">
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 px-2 text-xs ${viewMode === 'unified' ? 'bg-neutral-700 text-white' : 'text-neutral-400'}`}
              onClick={() => persistViewMode('unified')}
            >
              <Rows3 className="h-3 w-3 mr-1" />
              Unified
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 px-2 text-xs ${viewMode === 'split' ? 'bg-neutral-700 text-white' : 'text-neutral-400'}`}
              onClick={() => persistViewMode('split')}
            >
              <Columns2 className="h-3 w-3 mr-1" />
              Split
            </Button>
          </div>
        </div>
      </div>

      {/* Main content area with optional sidebar */}
      <div className="flex-1 flex min-h-0 gap-0">
        {/* File tree sidebar */}
        {sidebarOpen && (
          <div className="w-56 shrink-0 border-r border-neutral-800 overflow-y-auto pr-1">
            {projectGroups.map(group => {
              const sidebarProjectCollapsed = sidebarCollapsedProjects.has(group.project)
              return (
                <div key={group.project} className="mb-1">
                  {multiProject && (
                    <button
                      onClick={() => setSidebarCollapsedProjects(prev => {
                        const next = new Set(prev)
                        if (next.has(group.project)) next.delete(group.project)
                        else next.add(group.project)
                        return next
                      })}
                      className="w-full flex items-center gap-1.5 px-2 py-1 text-left hover:bg-neutral-800/50 rounded"
                    >
                      {sidebarProjectCollapsed
                        ? <ChevronRight className="h-3 w-3 text-blue-400 shrink-0" />
                        : <ChevronDown className="h-3 w-3 text-blue-400 shrink-0" />
                      }
                      <FolderOpen className="h-3 w-3 text-blue-400 shrink-0" />
                      <span className="text-[11px] font-medium text-blue-300 truncate">{group.project}</span>
                    </button>
                  )}
                  {!sidebarProjectCollapsed && group.files.map(file => {
                    const filePath = file.newPath || file.oldPath
                    const fileName = filePath.split('/').pop() || filePath
                    const stats = getFileStats(file)
                    return (
                      <button
                        key={filePath}
                        onClick={() => scrollToFile(filePath)}
                        className={`w-full flex items-center gap-1.5 px-2 py-0.5 text-left hover:bg-neutral-800/50 rounded group ${multiProject ? 'ml-3' : ''}`}
                        title={filePath}
                      >
                        <FileCode className="h-3 w-3 text-neutral-500 shrink-0" />
                        <span className="text-[11px] text-neutral-300 truncate flex-1">{fileName}</span>
                        <span className="text-[10px] shrink-0 opacity-0 group-hover:opacity-100">
                          <span className="text-green-400">+{stats.added}</span>
                          <span className="text-red-400 ml-0.5">-{stats.removed}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}

        {/* File list grouped by project */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pl-1">
        {/* General comments */}
        {(() => {
          const generalComments = comments.filter(c => !c.file && (showResolved || !c.resolved))
          if (generalComments.length === 0) return null
          return (
            <div className="shrink-0 mb-1 space-y-1">
              <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wide px-1">General Comments</h4>
              {generalComments.map((c, i) => (
                <InlineComment
                  key={i}
                  comment={c}
                  onDelete={readOnly ? undefined : () => onCommentsChange(comments.filter(gc => gc !== c))}
                  onToggleResolved={readOnly ? undefined : () => onCommentsChange(comments.map(gc => gc === c ? { ...gc, resolved: !gc.resolved } : gc))}
                />
              ))}
            </div>
          )
        })()}

        {/* Orphaned comments — files no longer in diff */}
        {orphanedByFile.size > 0 && (
          <div className="shrink-0 mb-1 border border-orange-800/30 rounded-md bg-orange-900/10 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-orange-900/20">
              <span className="text-[10px] text-orange-300 uppercase tracking-wide font-medium">
                Comments on files no longer in diff
              </span>
              {!readOnly && orphanedComments.some(c => !c.resolved) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-2 text-[10px] text-orange-300 hover:text-orange-200"
                  onClick={handleResolveAllOrphaned}
                >
                  <Check className="h-3 w-3 mr-1" /> Resolve all
                </Button>
              )}
            </div>
            {[...orphanedByFile.entries()].map(([file, fileComments]) => (
              <div key={file} className="px-3 py-1.5 border-t border-orange-800/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-orange-200/70">{file}</span>
                  {!readOnly && fileComments.some(c => !c.resolved) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-2 text-[10px] text-orange-300 hover:text-orange-200"
                      onClick={() => handleResolveOrphanedFile(file)}
                    >
                      <Check className="h-3 w-3 mr-1" /> Resolve
                    </Button>
                  )}
                </div>
                {fileComments.map((c, i) => (
                  <InlineComment
                    key={i}
                    comment={c}
                    onDelete={readOnly ? undefined : () => handleDeleteComment(c.file, c.line)}
                    onToggleResolved={readOnly ? undefined : () => handleToggleResolved(c.file, c.line)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {projectGroups.map(group => {
          const projectCollapsed = collapsedProjects.has(group.project)
          const projectStats = group.files.reduce((acc, f) => {
            const s = getFileStats(f)
            return { added: acc.added + s.added, removed: acc.removed + s.removed }
          }, { added: 0, removed: 0 })

          return (
            <div key={group.project}>
              {/* Project header — only show when multiple projects */}
              {multiProject && (
                <button
                  onClick={() => toggleProject(group.project)}
                  className="w-full flex items-center gap-2 px-3 py-2 mb-1 rounded-md bg-neutral-800/70 hover:bg-neutral-800 transition-colors text-left"
                >
                  {projectCollapsed
                    ? <ChevronRight className="h-4 w-4 text-blue-400 shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-blue-400 shrink-0" />
                  }
                  <FolderOpen className="h-4 w-4 text-blue-400 shrink-0" />
                  <span className="text-sm font-medium text-blue-300">{group.project}</span>
                  <span className="text-xs text-neutral-500">{group.files.length} file{group.files.length !== 1 ? 's' : ''}</span>
                  <span className="ml-auto text-xs shrink-0">
                    <span className="text-green-400">+{projectStats.added}</span>
                    <span className="text-red-400 ml-1">-{projectStats.removed}</span>
                  </span>
                </button>
              )}

              {/* Files in this project */}
              {!projectCollapsed && (
                <div className={`space-y-2 ${multiProject ? 'ml-4' : ''}`}>
                  {group.files.map(file => {
                    const filePath = file.newPath || file.oldPath
                    const stats = getFileStats(file)
                    const collapsed = collapsedFiles.has(filePath)
                    const fileCommentCount = comments.filter(c => c.file === filePath).length

                    return (
                      <div key={filePath} ref={el => setFileRef(filePath, el)} className="border border-neutral-800 rounded-md overflow-hidden">
                        {/* File header */}
                        <button
                          onClick={() => toggleFile(filePath)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 bg-neutral-800/50 hover:bg-neutral-800 transition-colors text-left"
                        >
                          {collapsed
                            ? <ChevronRight className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                            : <ChevronDown className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                          }
                          <FileCode className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                          <span className="text-xs text-neutral-200 font-mono truncate">{filePath}</span>
                          {file.isNew && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/40 text-green-300 shrink-0">new</span>}
                          {file.isDeleted && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/40 text-red-300 shrink-0">deleted</span>}
                          {fileCommentCount > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300 shrink-0">
                              {fileCommentCount} comment{fileCommentCount !== 1 ? 's' : ''}
                            </span>
                          )}
                          <span className="ml-auto text-xs shrink-0">
                            <span className="text-green-400">+{stats.added}</span>
                            <span className="text-red-400 ml-1">-{stats.removed}</span>
                          </span>
                        </button>

                        {/* Diff content */}
                        {!collapsed && (() => {
                          const totalLines = stats.added + stats.removed
                          const isLarge = totalLines > LARGE_DIFF_THRESHOLD
                          const isForced = forcedLargeFiles.has(filePath)

                          if (isLarge && !isForced) {
                            return (
                              <div className="flex flex-col items-center gap-2 py-6 px-4 bg-neutral-900/30">
                                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                                <p className="text-xs text-neutral-400 text-center">
                                  Large diff not rendered — {totalLines} lines changed ({stats.added} additions, {stats.removed} deletions)
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={e => {
                                    e.stopPropagation()
                                    setForcedLargeFiles(prev => new Set([...prev, filePath]))
                                  }}
                                >
                                  Load diff
                                </Button>
                              </div>
                            )
                          }

                          return (
                            <div className="overflow-x-auto text-neutral-300">
                              {viewMode === 'unified'
                                ? <UnifiedView
                                    file={file}
                                    commentMap={commentMap}
                                    activeComment={activeComment}
                                    onStartComment={setActiveComment}
                                    onSubmitComment={handleSubmitComment}
                                    onCancelComment={() => setActiveComment(null)}
                                    onDeleteComment={handleDeleteComment}
                                    onToggleResolved={handleToggleResolved}
                                    readOnly={readOnly}
                                  />
                                : <SplitView
                                    file={file}
                                    commentMap={commentMap}
                                    activeComment={activeComment}
                                    onStartComment={setActiveComment}
                                    onSubmitComment={handleSubmitComment}
                                    onCancelComment={() => setActiveComment(null)}
                                    onDeleteComment={handleDeleteComment}
                                    onToggleResolved={handleToggleResolved}
                                    readOnly={readOnly}
                                  />
                              }
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        </div>
      </div>
    </div>
  )
}
