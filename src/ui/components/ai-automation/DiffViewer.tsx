import { useState, useEffect, useMemo, useRef, useCallback, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { Columns2, Rows3, FileCode, ChevronRight, ChevronDown, Plus, X, MessageSquare, AlertTriangle, Check, CircleCheck, FolderOpen, PanelLeftClose, PanelLeft, Folder } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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

    // Merge with existing entry if same file path already parsed (e.g. committed + uncommitted diffs)
    const key = newPath || oldPath
    const existing = files.find(f => (f.newPath || f.oldPath) === key)
    if (existing) {
      existing.hunks.push(...hunks)
      if (isNew) existing.isNew = true
      if (isDeleted) existing.isDeleted = true
    } else {
      files.push({ oldPath, newPath, isNew, isDeleted, hunks })
    }
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

// Qualify a file path with project name to avoid collisions across projects
function qualifyPath(project: string, filePath: string): string {
  return `${project}::${filePath}`
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
}> = ({ comment, onDelete, onToggleResolved }) => {
  const agentResolved = comment.resolved && comment.resolvedBy === 'agent'
  return (
  <div
    className="flex items-start gap-2 mx-2 my-1 p-2 rounded border"
    style={comment.resolved
      ? agentResolved
        ? { background: 'var(--ai-purple-subtle)', borderColor: 'var(--ai-purple-subtle)' }
        : { background: 'var(--ai-surface-2)', borderColor: 'var(--ai-border-subtle)' }
      : { background: 'var(--ai-warning-subtle)', borderColor: 'var(--ai-warning-subtle)' }
    }
  >
    <MessageSquare
      className="h-3.5 w-3.5 mt-0.5 shrink-0"
      style={{ color: agentResolved ? 'var(--ai-purple)' : comment.resolved ? 'var(--ai-text-tertiary)' : 'var(--ai-warning)' }}
    />
    <div className="flex-1 min-w-0">
      {agentResolved && (
        <span className="text-[9px] px-1 py-0.5 rounded mb-0.5 inline-block" style={{ background: 'var(--ai-purple-subtle)', color: 'var(--ai-purple)' }}>
          agent resolved — verify
        </span>
      )}
      <p
        className={`text-xs whitespace-pre-wrap ${comment.resolved && !agentResolved ? 'line-through' : ''}`}
        style={{ color: agentResolved ? 'var(--ai-text-secondary)' : comment.resolved ? 'var(--ai-text-tertiary)' : 'var(--ai-warning)' }}
      >{comment.comment}</p>
    </div>
    {onToggleResolved && (
      <button
        onClick={onToggleResolved}
        className="shrink-0"
        style={{ color: comment.resolved ? 'var(--ai-success)' : 'var(--ai-text-tertiary)' }}
        title={comment.resolved ? 'Mark as unresolved' : 'Mark as resolved'}
      >
        <CircleCheck className="h-3.5 w-3.5" />
      </button>
    )}
    {onDelete && (
      <button
        onClick={onDelete}
        className="shrink-0"
        style={{ color: 'var(--ai-text-tertiary)' }}
      >
        <X className="h-3 w-3" />
      </button>
    )}
  </div>
  )
}

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
    <div
      className="mx-2 my-1 p-2 rounded border"
      style={{ background: 'var(--ai-surface-2)', borderColor: 'var(--ai-border)' }}
    >
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
        className="w-full min-h-[60px] bg-transparent text-xs outline-none resize-y"
        style={{ color: 'var(--ai-text-primary)', }}
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
  onDeleteComment: (commentId: string) => void
  onToggleResolved: (commentId: string) => void
  readOnly: boolean
  children: React.ReactNode
}> = ({ line, filePath, commentMap, activeComment, onStartComment, onSubmitComment, onCancelComment, onDeleteComment, onToggleResolved, readOnly, children }) => {
  const lineNum = line.newLineNum ?? line.oldLineNum
  const key = lineNum !== undefined ? commentKey(filePath, lineNum) : null
  const lineComments = key ? (commentMap.get(key) || []) : []
  const isActive = key !== null && activeComment === key

  return (
    <>
      <div
        className="flex group"
        style={{
          background: line.type === 'added' ? 'var(--ai-diff-added-bg)' :
            line.type === 'removed' ? 'var(--ai-diff-removed-bg)' : undefined
        }}
      >
        {/* Comment gutter */}
        {!readOnly && lineNum !== undefined ? (
          <button
            className="w-5 shrink-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: 'var(--ai-accent)' }}
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
      {lineComments.map(c => (
        <InlineComment
          key={c.id}
          comment={c}
          onDelete={readOnly ? undefined : () => onDeleteComment(c.id)}
          onToggleResolved={readOnly ? undefined : () => onToggleResolved(c.id)}
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
  qualifiedPath: string
  commentMap: Map<string, AIHumanComment[]>
  activeComment: string | null
  onStartComment: (key: string) => void
  onSubmitComment: (file: string, line: number, text: string) => void
  onCancelComment: () => void
  onDeleteComment: (commentId: string) => void
  onToggleResolved: (commentId: string) => void
  readOnly: boolean
}> = ({ file, qualifiedPath, commentMap, activeComment, onStartComment, onSubmitComment, onCancelComment, onDeleteComment, onToggleResolved, readOnly }) => {
  const filePath = qualifiedPath
  return (
    <div className="font-mono text-xs leading-5">
      {file.hunks.map((hunk, hi) => (
        <div key={hi}>
          <div
            className="px-4 py-0.5 select-none border-y"
            style={{ background: 'var(--ai-accent-subtle)', color: 'var(--ai-accent)', borderColor: 'var(--ai-border-subtle)' }}
          >
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
              <span
                className="w-12 text-right pr-2 select-none shrink-0 border-r"
                style={{ color: 'var(--ai-text-tertiary)', borderColor: 'var(--ai-border-subtle)' }}
              >
                {line.oldLineNum ?? ''}
              </span>
              <span
                className="w-12 text-right pr-2 select-none shrink-0 border-r"
                style={{ color: 'var(--ai-text-tertiary)', borderColor: 'var(--ai-border-subtle)' }}
              >
                {line.newLineNum ?? ''}
              </span>
              <span
                className="w-4 text-center select-none shrink-0"
                style={{
                  color: line.type === 'added' ? 'var(--ai-diff-added-text)' :
                    line.type === 'removed' ? 'var(--ai-diff-removed-text)' : 'var(--ai-text-tertiary)'
                }}
              >
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
  qualifiedPath: string
  commentMap: Map<string, AIHumanComment[]>
  activeComment: string | null
  onStartComment: (key: string) => void
  onSubmitComment: (file: string, line: number, text: string) => void
  onCancelComment: () => void
  onDeleteComment: (commentId: string) => void
  onToggleResolved: (commentId: string) => void
  readOnly: boolean
}> = ({ file, qualifiedPath, commentMap, activeComment, onStartComment, onSubmitComment, onCancelComment, onDeleteComment, onToggleResolved, readOnly }) => {
  const filePath = qualifiedPath
  return (
    <div className="font-mono text-xs leading-5">
      {file.hunks.map((hunk, hi) => {
        const pairs = buildSplitPairs(hunk.lines)
        return (
          <div key={hi}>
            <div
              className="px-4 py-0.5 select-none border-y"
              style={{ background: 'var(--ai-accent-subtle)', color: 'var(--ai-accent)', borderColor: 'var(--ai-border-subtle)' }}
            >
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
                      <div
                        className="flex-1 flex min-w-0"
                        style={{ background: pair.left.type === 'removed' ? 'var(--ai-diff-removed-bg)' : undefined }}
                      >
                        <span
                          className="w-12 text-right pr-2 select-none shrink-0 border-r"
                          style={{ color: 'var(--ai-diff-line-num)', borderColor: 'var(--ai-border-subtle)' }}
                        >
                          {pair.left.oldLineNum ?? ''}
                        </span>
                        <span
                          className="w-4 text-center select-none shrink-0"
                          style={{ color: pair.left.type === 'removed' ? 'var(--ai-diff-removed-text)' : 'var(--ai-text-tertiary)' }}
                        >
                          {pair.left.type === 'removed' ? '-' : ' '}
                        </span>
                        <span className="flex-1 px-2 whitespace-pre overflow-x-auto">{pair.left.content}</span>
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0" style={{ background: 'var(--ai-diff-empty-bg)' }} />
                    )}
                    <div className="w-px shrink-0" style={{ background: 'var(--ai-surface-3)' }} />
                    {/* Right side */}
                    {pair.right ? (
                      <div
                        className="flex-1 flex min-w-0"
                        style={{ background: pair.right.type === 'added' ? 'var(--ai-diff-added-bg)' : undefined }}
                      >
                        {!readOnly && lineNum !== undefined ? (
                          <button
                            className="w-5 shrink-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color: 'var(--ai-accent)' }}
                            onClick={() => key && onStartComment(key)}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        ) : (
                          <span className="w-5 shrink-0" />
                        )}
                        <span
                          className="w-12 text-right pr-2 select-none shrink-0 border-r"
                          style={{ color: 'var(--ai-text-tertiary)', borderColor: 'var(--ai-border-subtle)' }}
                        >
                          {pair.right.newLineNum ?? ''}
                        </span>
                        <span
                          className="w-4 text-center select-none shrink-0"
                          style={{ color: pair.right.type === 'added' ? 'var(--ai-diff-added-text)' : 'var(--ai-text-tertiary)' }}
                        >
                          {pair.right.type === 'added' ? '+' : ' '}
                        </span>
                        <span className="flex-1 px-2 whitespace-pre overflow-x-auto">{pair.right.content}</span>
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0" style={{ background: 'var(--ai-diff-empty-bg)' }} />
                    )}
                  </div>
                  {/* Comments below the pair */}
                  {lineComments.map(c => (
                    <InlineComment
                      key={c.id}
                      comment={c}
                      onDelete={readOnly ? undefined : () => onDeleteComment(c.id)}
                      onToggleResolved={readOnly ? undefined : () => onToggleResolved(c.id)}
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

// File tree types and builder for sidebar
interface FileTreeNode {
  name: string
  fullPath: string // full file path for leaf nodes
  children: FileTreeNode[]
  file?: DiffFile // only on leaf nodes
}

function buildFileTree(files: DiffFile[]): FileTreeNode[] {
  const root: FileTreeNode = { name: '', fullPath: '', children: [] }

  for (const file of files) {
    const filePath = file.newPath || file.oldPath
    const parts = filePath.split('/')
    let current = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1
      let child = current.children.find(c => c.name === part && !c.file === !isFile)
      if (!child) {
        child = { name: part, fullPath: isFile ? filePath : parts.slice(0, i + 1).join('/'), children: [], ...(isFile ? { file } : {}) }
        current.children.push(child)
      }
      current = child
    }
  }

  // Collapse single-child folders: a/b/c → a/b/c
  function collapse(node: FileTreeNode): FileTreeNode {
    node.children = node.children.map(collapse)
    if (!node.file && node.children.length === 1 && !node.children[0].file) {
      const child = node.children[0]
      return { ...child, name: node.name + '/' + child.name }
    }
    return node
  }

  return root.children.map(collapse)
}

const FileTreeItem: FC<{
  node: FileTreeNode
  depth: number
  getFileStats: (file: DiffFile) => { added: number; removed: number }
  onScrollToFile: (path: string) => void
  collapsedFolders: Set<string>
  onToggleFolder: (path: string) => void
}> = ({ node, depth, getFileStats, onScrollToFile, collapsedFolders, onToggleFolder }) => {
  if (node.file) {
    const stats = getFileStats(node.file)
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onScrollToFile(node.fullPath)}
            className="w-full flex items-center gap-1.5 py-0.5 pr-1 text-left rounded group"
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            <FileCode className="h-3 w-3 shrink-0" style={{ color: 'var(--ai-text-tertiary)' }} />
            <span className="text-[11px] truncate flex-1" style={{ color: 'var(--ai-text-secondary)' }}>{node.name}</span>
            <span className="text-[10px] shrink-0 opacity-0 group-hover:opacity-100">
              <span style={{ color: 'var(--ai-diff-added-text)' }}>+{stats.added}</span>
              <span style={{ color: 'var(--ai-diff-removed-text)' }} className="ml-0.5">-{stats.removed}</span>
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="text-xs font-mono">{node.fullPath}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  const isCollapsed = collapsedFolders.has(node.fullPath)

  return (
    <div>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onToggleFolder(node.fullPath)}
            className="w-full flex items-center gap-1 py-0.5 text-left rounded"
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            {isCollapsed
              ? <ChevronRight className="h-3 w-3 shrink-0" style={{ color: 'var(--ai-text-tertiary)' }} />
              : <ChevronDown className="h-3 w-3 shrink-0" style={{ color: 'var(--ai-text-tertiary)' }} />
            }
            <Folder className="h-3 w-3 shrink-0" style={{ color: 'var(--ai-text-tertiary)' }} />
            <span className="text-[11px] truncate" style={{ color: 'var(--ai-text-tertiary)' }}>{node.name}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="text-xs font-mono">{node.fullPath}</p>
        </TooltipContent>
      </Tooltip>
      {!isCollapsed && node.children.map(child => (
        <FileTreeItem
          key={child.fullPath}
          node={child}
          depth={depth + 1}
          getFileStats={getFileStats}
          onScrollToFile={onScrollToFile}
          collapsedFolders={collapsedFolders}
          onToggleFolder={onToggleFolder}
        />
      ))}
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
  const [sidebarCollapsedFolders, setSidebarCollapsedFolders] = useState<Set<string>>(new Set())
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
    // Build set of all qualified file paths across projects
    const fileSet = new Set<string>()
    for (const group of projectGroups) {
      for (const f of group.files) {
        const raw = f.newPath || f.oldPath
        fileSet.add(multiProject ? qualifyPath(group.project, raw) : raw)
      }
    }
    return comments.filter(c => {
      if (!c.file) return false
      if (!showResolved && c.resolved) return false
      return !fileSet.has(c.file)
    })
  }, [comments, projectGroups, multiProject, showResolved])

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
    onCommentsChange(comments.map(c =>
      c.file === file && !c.resolved ? { ...c, resolved: true } : c
    ))
  }

  const handleResolveAllOrphaned = () => {
    const orphanIds = new Set(orphanedComments.map(c => c.id))
    onCommentsChange(comments.map(c =>
      orphanIds.has(c.id) && !c.resolved ? { ...c, resolved: true } : c
    ))
  }

  const handleSubmitComment = (file: string, line: number, text: string) => {
    const newComment: AIHumanComment = {
      id: crypto.randomUUID(),
      file,
      line,
      comment: text,
      createdAt: new Date().toISOString()
    }
    onCommentsChange([...comments, newComment])
    setActiveComment(null)
  }

  const handleDeleteComment = (commentId: string) => {
    onCommentsChange(comments.filter(c => c.id !== commentId))
  }

  const handleToggleResolved = (commentId: string) => {
    onCommentsChange(comments.map(c =>
      c.id === commentId ? { ...c, resolved: !c.resolved, resolvedBy: c.resolved ? undefined : 'human' } : c
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
    return <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--ai-text-tertiary)' }}>Loading diff...</div>
  }

  if (projectDiffs.length === 0 || files.length === 0) {
    return <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--ai-text-tertiary)' }}>No changes to display</div>
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
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--ai-text-tertiary)' }}>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            style={{ color: 'var(--ai-text-tertiary)' }}
            onClick={() => setSidebarOpen(prev => !prev)}
            title={sidebarOpen ? 'Hide file tree' : 'Show file tree'}
          >
            {sidebarOpen ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeft className="h-3.5 w-3.5" />}
          </Button>
          {files.length} file{files.length !== 1 ? 's' : ''} changed
          <span style={{ color: 'var(--ai-diff-added-text)' }} className=" ml-2">+{totalStats.added}</span>
          <span style={{ color: 'var(--ai-diff-removed-text)' }} className=" ml-1">-{totalStats.removed}</span>
          {comments.length > 0 && (
            <span className="ml-3" style={{ color: 'var(--ai-warning)' }}>
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
              <span className="text-xs" style={{ color: 'var(--ai-text-tertiary)' }}>Show resolved ({resolvedCount})</span>
            </label>
          )}
          <div className="flex items-center gap-1 rounded p-0.5" style={{ background: 'var(--ai-surface-2)' }}>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              style={viewMode === 'unified'
                ? { background: 'var(--ai-surface-3)', color: 'var(--ai-text-primary)' }
                : { color: 'var(--ai-text-tertiary)' }
              }
              onClick={() => persistViewMode('unified')}
            >
              <Rows3 className="h-3 w-3 mr-1" />
              Unified
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              style={viewMode === 'split'
                ? { background: 'var(--ai-surface-3)', color: 'var(--ai-text-primary)' }
                : { color: 'var(--ai-text-tertiary)' }
              }
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
          <div className="w-56 shrink-0 border-r overflow-y-auto pr-1" style={{ borderColor: 'var(--ai-border-subtle)' }}>
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
                      className="w-full flex items-center gap-1.5 px-2 py-1 text-left rounded"
                      style={{ }}
                    >
                      {sidebarProjectCollapsed
                        ? <ChevronRight className="h-3 w-3 shrink-0" style={{ color: 'var(--ai-accent)' }} />
                        : <ChevronDown className="h-3 w-3 shrink-0" style={{ color: 'var(--ai-accent)' }} />
                      }
                      <FolderOpen className="h-3 w-3 shrink-0" style={{ color: 'var(--ai-accent)' }} />
                      <span className="text-[11px] font-medium truncate" style={{ color: 'var(--ai-accent)' }}>{group.project}</span>
                    </button>
                  )}
                  {!sidebarProjectCollapsed && (() => {
                    const tree = buildFileTree(group.files)
                    return tree.map(node => (
                      <FileTreeItem
                        key={node.fullPath}
                        node={node}
                        depth={multiProject ? 1 : 0}
                        getFileStats={getFileStats}
                        onScrollToFile={(raw) => scrollToFile(multiProject ? qualifyPath(group.project, raw) : raw)}
                        collapsedFolders={sidebarCollapsedFolders}
                        onToggleFolder={path => setSidebarCollapsedFolders(prev => {
                          const next = new Set(prev)
                          if (next.has(path)) next.delete(path)
                          else next.add(path)
                          return next
                        })}
                      />
                    ))
                  })()}
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
              <h4 className="text-xs font-medium uppercase tracking-wide px-1" style={{ color: 'var(--ai-text-tertiary)' }}>General Comments</h4>
              {generalComments.map(c => (
                <InlineComment
                  key={c.id}
                  comment={c}
                  onDelete={readOnly ? undefined : () => onCommentsChange(comments.filter(gc => gc.id !== c.id))}
                  onToggleResolved={readOnly ? undefined : () => onCommentsChange(comments.map(gc => gc.id === c.id ? { ...gc, resolved: !gc.resolved } : gc))}
                />
              ))}
            </div>
          )
        })()}

        {/* Orphaned comments — files no longer in diff */}
        {orphanedByFile.size > 0 && (
          <div
            className="shrink-0 mb-1 border rounded-md overflow-hidden"
            style={{ borderColor: 'var(--ai-warning-subtle)', background: 'var(--ai-warning-subtle)' }}
          >
            <div
              className="flex items-center justify-between px-3 py-1.5"
              style={{ background: 'var(--ai-warning-subtle)' }}
            >
              <span className="text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--ai-warning)' }}>
                Comments on files no longer in diff
              </span>
              {!readOnly && orphanedComments.some(c => !c.resolved) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-2 text-[10px]"
                  style={{ color: 'var(--ai-warning)' }}
                  onClick={handleResolveAllOrphaned}
                >
                  <Check className="h-3 w-3 mr-1" /> Resolve all
                </Button>
              )}
            </div>
            {[...orphanedByFile.entries()].map(([file, fileComments]) => (
              <div key={file} className="px-3 py-1.5 border-t" style={{ borderColor: 'var(--ai-warning-subtle)' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono" style={{ color: 'var(--ai-warning)', opacity: 0.7 }}>{file}</span>
                  {!readOnly && fileComments.some(c => !c.resolved) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-2 text-[10px]"
                      style={{ color: 'var(--ai-warning)' }}
                      onClick={() => handleResolveOrphanedFile(file)}
                    >
                      <Check className="h-3 w-3 mr-1" /> Resolve
                    </Button>
                  )}
                </div>
                {fileComments.map(c => (
                  <InlineComment
                    key={c.id}
                    comment={c}
                    onDelete={readOnly ? undefined : () => handleDeleteComment(c.id)}
                    onToggleResolved={readOnly ? undefined : () => handleToggleResolved(c.id)}
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
                  className="w-full flex items-center gap-2 px-3 py-2 mb-1 rounded-md transition-colors text-left sticky top-0 z-20"
                  style={{ background: 'var(--ai-surface-2)' }}
                >
                  {projectCollapsed
                    ? <ChevronRight className="h-4 w-4 shrink-0" style={{ color: 'var(--ai-accent)' }} />
                    : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: 'var(--ai-accent)' }} />
                  }
                  <FolderOpen className="h-4 w-4 shrink-0" style={{ color: 'var(--ai-accent)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--ai-accent)' }}>{group.project}</span>
                  <span className="text-xs" style={{ color: 'var(--ai-text-tertiary)' }}>{group.files.length} file{group.files.length !== 1 ? 's' : ''}</span>
                  <span className="ml-auto text-xs shrink-0">
                    <span style={{ color: 'var(--ai-diff-added-text)' }} className="">+{projectStats.added}</span>
                    <span style={{ color: 'var(--ai-diff-removed-text)' }} className=" ml-1">-{projectStats.removed}</span>
                  </span>
                </button>
              )}

              {/* Files in this project */}
              {!projectCollapsed && (
                <div className={`space-y-2 ${multiProject ? 'ml-4' : ''}`}>
                  {group.files.map(file => {
                    const rawPath = file.newPath || file.oldPath
                    const filePath = multiProject ? qualifyPath(group.project, rawPath) : rawPath
                    const stats = getFileStats(file)
                    const collapsed = collapsedFiles.has(filePath)
                    const fileCommentCount = comments.filter(c => c.file === filePath).length

                    return (
                      <div
                        key={filePath}
                        ref={el => setFileRef(filePath, el)}
                      >
                        {/* File header — sticky below project header */}
                        <button
                          onClick={() => toggleFile(filePath)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 transition-colors text-left sticky z-10 border border-b-0 rounded-t-md"
                          style={{ background: 'var(--ai-surface-2)', borderColor: 'var(--ai-border-subtle)', top: multiProject ? '37px' : '0px' }}
                        >
                          {collapsed
                            ? <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--ai-text-tertiary)' }} />
                            : <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--ai-text-tertiary)' }} />
                          }
                          <FileCode className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--ai-text-tertiary)' }} />
                          <span className="text-xs font-mono truncate" style={{ color: 'var(--ai-text-primary)' }}>{rawPath}</span>
                          {file.isNew && <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: 'var(--ai-diff-added-bg)', color: 'var(--ai-diff-added-text)' }}>new</span>}
                          {file.isDeleted && <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: 'var(--ai-diff-removed-bg)', color: 'var(--ai-diff-removed-text)' }}>deleted</span>}
                          {fileCommentCount > 0 && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                              style={{ background: 'var(--ai-warning-subtle)', color: 'var(--ai-warning)' }}
                            >
                              {fileCommentCount} comment{fileCommentCount !== 1 ? 's' : ''}
                            </span>
                          )}
                          <span className="ml-auto text-xs shrink-0">
                            <span style={{ color: 'var(--ai-diff-added-text)' }} className="">+{stats.added}</span>
                            <span style={{ color: 'var(--ai-diff-removed-text)' }} className=" ml-1">-{stats.removed}</span>
                          </span>
                        </button>

                        {/* Diff content */}
                        {!collapsed && (
                          <div
                            className="border border-t-0 rounded-b-md overflow-hidden mb-2"
                            style={{ borderColor: 'var(--ai-border-subtle)' }}
                          >
                            {(() => {
                              const totalLines = stats.added + stats.removed
                              const isLarge = totalLines > LARGE_DIFF_THRESHOLD
                              const isForced = forcedLargeFiles.has(filePath)

                              if (isLarge && !isForced) {
                                return (
                                  <div className="flex flex-col items-center gap-2 py-6 px-4" style={{ background: 'var(--ai-surface-0)' }}>
                                    <AlertTriangle className="h-5 w-5" style={{ color: 'var(--ai-warning)' }} />
                                    <p className="text-xs text-center" style={{ color: 'var(--ai-text-tertiary)' }}>
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
                                <div className="overflow-x-auto" style={{ color: 'var(--ai-text-secondary)' }}>
                                  {viewMode === 'unified'
                                    ? <UnifiedView
                                        file={file}
                                        qualifiedPath={filePath}
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
                                        qualifiedPath={filePath}
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
                        )}
                        {collapsed && <div className="mb-2" />}
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
