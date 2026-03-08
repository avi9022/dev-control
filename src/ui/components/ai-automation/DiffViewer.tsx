import { useState, useEffect, useMemo, useRef, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { Columns2, Rows3, FileCode, ChevronRight, ChevronDown, Plus, X, MessageSquare, AlertTriangle, Check, CircleCheck } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'

const LARGE_DIFF_THRESHOLD = 200 // lines changed

interface DiffViewerProps {
  taskId: string
  comments: AIHumanComment[]
  onCommentsChange: (comments: AIHumanComment[]) => void
  readOnly?: boolean
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

export const DiffViewer: FC<DiffViewerProps> = ({ taskId, comments, onCommentsChange, readOnly = false }) => {
  const [rawDiff, setRawDiff] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('unified')
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set())
  const [forcedLargeFiles, setForcedLargeFiles] = useState<Set<string>>(new Set())
  const [activeComment, setActiveComment] = useState<string | null>(null)
  const [showResolved, setShowResolved] = useState(true)

  useEffect(() => {
    setLoading(true)
    window.electron.aiGetTaskDiff(taskId).then(diff => {
      setRawDiff(diff)
      setLoading(false)
    })
  }, [taskId])

  const files = useMemo(() => rawDiff ? parseDiff(rawDiff) : [], [rawDiff])

  const resolvedCount = comments.filter(c => c.resolved).length

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

  if (!rawDiff || files.length === 0) {
    return <div className="h-full flex items-center justify-center text-neutral-500 text-sm">No changes to display</div>
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-1 pb-3 shrink-0">
        <div className="text-xs text-neutral-400">
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
                onCheckedChange={(checked) => setShowResolved(!!checked)}
              />
              <span className="text-xs text-neutral-400">Show resolved ({resolvedCount})</span>
            </label>
          )}
          <div className="flex items-center gap-1 bg-neutral-800 rounded p-0.5">
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 px-2 text-xs ${viewMode === 'unified' ? 'bg-neutral-700 text-white' : 'text-neutral-400'}`}
              onClick={() => setViewMode('unified')}
            >
              <Rows3 className="h-3 w-3 mr-1" />
              Unified
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 px-2 text-xs ${viewMode === 'split' ? 'bg-neutral-700 text-white' : 'text-neutral-400'}`}
              onClick={() => setViewMode('split')}
            >
              <Columns2 className="h-3 w-3 mr-1" />
              Split
            </Button>
          </div>
        </div>
      </div>

      {/* General comments */}
      {(() => {
        const generalComments = comments.filter(c => !c.file && (showResolved || !c.resolved))
        if (generalComments.length === 0) return null
        return (
          <div className="shrink-0 mb-3 space-y-1">
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

      {/* File list */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
        {files.map(file => {
          const path = file.newPath || file.oldPath
          const stats = getFileStats(file)
          const collapsed = collapsedFiles.has(path)
          const fileCommentCount = comments.filter(c => c.file === path).length

          return (
            <div key={path} className="border border-neutral-800 rounded-md overflow-hidden">
              {/* File header */}
              <button
                onClick={() => toggleFile(path)}
                className="w-full flex items-center gap-2 px-3 py-1.5 bg-neutral-800/50 hover:bg-neutral-800 transition-colors text-left"
              >
                {collapsed
                  ? <ChevronRight className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                  : <ChevronDown className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                }
                <FileCode className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                <span className="text-xs text-neutral-200 font-mono truncate">{path}</span>
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
                const isForced = forcedLargeFiles.has(path)

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
                          setForcedLargeFiles(prev => new Set([...prev, path]))
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
    </div>
  )
}
