import { useState, useEffect, useMemo, useRef, useCallback, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { Columns2, Rows3, FileCode, ChevronRight, ChevronDown, MessageSquare, AlertTriangle, Check, FolderOpen, PanelLeftClose, PanelLeft } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { useSearchOverlay } from './useSearchOverlay'
import { SearchBar, SearchOverlayLayer } from './SearchOverlay'
import { RESOLVER } from '@/shared/constants'
import { type DiffFile, LARGE_DIFF_THRESHOLD, parseDiff, getFileStats, qualifyPath, commentKey } from './diff-parser'
import { InlineComment } from './InlineComment'
import { UnifiedView } from './UnifiedView'
import { SplitView } from './SplitView'
import { buildFileTree, FileTreeItem } from './FileTreeSidebar'

interface DiffViewerProps {
  taskId: string
  comments: AIHumanComment[]
  onCommentsChange: (comments: AIHumanComment[]) => void
  readOnly?: boolean
  settings?: AIAutomationSettings
  onUpdateSettings?: (updates: Partial<AIAutomationSettings>) => void
}

type ViewMode = 'unified' | 'split'

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
  const diffSearch = useSearchOverlay([files, viewMode])
  const multiProject = projectGroups.length > 1

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
      c.id === commentId ? {
        ...c,
        resolved: !c.resolved,
        resolvedBy: c.resolved
          ? (c.resolvedBy || []).filter(r => r !== RESOLVER.HUMAN)
          : [...(c.resolvedBy || []).filter(r => r !== RESOLVER.HUMAN), RESOLVER.HUMAN]
      } : c
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
          <SearchBar {...diffSearch} />
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
        <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pl-1 relative" ref={diffSearch.setContentRef}>
        <SearchOverlayLayer overlayRef={diffSearch.overlayRef} active={!!diffSearch.searchQuery} />
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
