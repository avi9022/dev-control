import { useState, type FC } from 'react'
import { CheckCircle, CircleCheck, EyeOff, Eye, Trash2, ArrowUpDown } from 'lucide-react'
import { useAIAutomation } from '@/ui/contexts/ai-automation'

interface ReviewCommentsCardProps {
  task: AITask
  pipeline: AIPipelinePhase[]
  isManualPhase: boolean
}

type CommentSort = 'date' | 'status'

export const ReviewCommentsCard: FC<ReviewCommentsCardProps> = ({ task, pipeline }) => {
  const { updateTask } = useAIAutomation()
  const [commentSort, setCommentSort] = useState<CommentSort>('date')

  const comments = task.humanComments || []
  const amendments = task.amendments || []
  const hasComments = comments.length > 0
  const hasAmendments = amendments.length > 0

  if (!hasComments && !hasAmendments) return null

  const handleToggleHidden = async (amendmentId: string) => {
    const updated = (task.amendments || []).map(a =>
      a.id === amendmentId ? { ...a, hidden: !a.hidden } : a
    )
    await updateTask(task.id, { amendments: updated })
  }

  const handleDelete = async (amendmentId: string) => {
    const updated = (task.amendments || []).filter(a => a.id !== amendmentId)
    await updateTask(task.id, { amendments: updated })
  }

  const handleToggleResolved = async (commentId: string) => {
    const updated = comments.map(c =>
      c.id === commentId ? { ...c, resolved: !c.resolved, resolvedBy: c.resolved ? undefined : 'human' } : c
    )
    await updateTask(task.id, { humanComments: updated })
  }

  const handleDeleteComment = async (commentId: string) => {
    const updated = comments.filter(c => c.id !== commentId)
    await updateTask(task.id, { humanComments: updated })
  }

  const handleResolveAll = async () => {
    const updated = comments.map(c => c.resolved ? c : { ...c, resolved: true, resolvedBy: 'human' as const })
    await updateTask(task.id, { humanComments: updated })
  }

  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--ai-text-tertiary)' }}>
        Review Comments & Amendments
      </h3>
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--ai-border-subtle)', backgroundColor: 'color-mix(in srgb, var(--ai-surface-1) 30%, transparent)' }}
      >
        {/* Review Comments */}
        {hasComments && (
          <>
            <div className="px-4 pt-3 pb-2 flex items-center justify-between">
              <span className="text-[11px] font-medium" style={{ color: 'var(--ai-text-tertiary)' }}>
                Comments
                <span className="ml-1.5 font-normal" style={{ opacity: 0.7 }}>
                  {comments.filter(c => !c.resolved).length} open
                  {comments.filter(c => c.resolved).length > 0 &&
                    ` · ${comments.filter(c => c.resolved).length} resolved`}
                </span>
              </span>
              <div className="flex items-center gap-2">
                {comments.some(c => !c.resolved) && (
                  <button
                    onClick={handleResolveAll}
                    className="text-[10px] flex items-center gap-1 transition-colors"
                    style={{ color: 'var(--ai-accent)' }}
                  >
                    <CheckCircle className="h-3 w-3" /> Resolve all
                  </button>
                )}
                <button
                  onClick={() => setCommentSort(prev => prev === 'date' ? 'status' : 'date')}
                  className="text-[10px] flex items-center gap-1 transition-colors"
                  style={{ color: 'var(--ai-text-tertiary)' }}
                  title={commentSort === 'date' ? 'Sorted by date — click to sort by status' : 'Sorted by status — click to sort by date'}
                >
                  <ArrowUpDown className="h-3 w-3" />
                  {commentSort === 'date' ? 'Date' : 'Status'}
                </button>
              </div>
            </div>
            {[...comments].sort((a, b) => {
              if (commentSort === 'status') {
                // Unresolved first, then resolved
                if (a.resolved !== b.resolved) return a.resolved ? 1 : -1
              }
              // By date (newest first)
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            }).map(c => (
              <div
                key={c.id}
                className="flex items-start gap-2.5 px-4 py-2.5"
                style={{
                  borderTop: '1px solid var(--ai-border-subtle)',
                  backgroundColor: c.resolved
                    ? 'transparent'
                    : 'color-mix(in srgb, var(--ai-warning-subtle) 40%, transparent)',
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {c.file ? (
                      <span className="text-[11px] font-mono" style={{ color: 'var(--ai-text-tertiary)' }}>
                        {c.file}:{c.line}
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium" style={{ color: c.resolved ? 'var(--ai-text-tertiary)' : 'var(--ai-warning)' }}>
                        General
                      </span>
                    )}
                    {c.createdAt && (
                      <span className="text-[10px] font-mono" style={{ color: 'var(--ai-text-tertiary)', opacity: 0.7 }}>
                        {new Date(c.createdAt).toLocaleDateString('en-GB')}
                      </span>
                    )}
                    {c.resolved && c.resolvedBy === 'agent' && (
                      <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: 'var(--ai-purple-subtle)', color: 'var(--ai-purple)' }}>
                        agent resolved
                      </span>
                    )}
                    {c.resolved && c.resolvedBy !== 'agent' && (
                      <CheckCircle className="h-3 w-3" style={{ color: 'var(--ai-success)' }} />
                    )}
                  </div>
                  <p
                    className={`text-xs mt-1 leading-relaxed ${c.resolved ? 'line-through' : ''}`}
                    style={{ color: c.resolved ? 'var(--ai-text-tertiary)' : 'var(--ai-text-secondary)' }}
                  >
                    {c.comment}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => handleToggleResolved(c.id)}
                    className="p-1 rounded hover:bg-[var(--ai-surface-3)] transition-colors"
                    title={c.resolved ? 'Mark as unresolved' : 'Mark as resolved'}
                  >
                    <CircleCheck className="h-3 w-3" style={{ color: c.resolved ? 'var(--ai-success)' : 'var(--ai-text-tertiary)' }} />
                  </button>
                  <button
                    onClick={() => handleDeleteComment(c.id)}
                    className="p-1 rounded hover:bg-[var(--ai-surface-3)] transition-colors"
                    title="Delete comment"
                  >
                    <Trash2 className="h-3 w-3" style={{ color: 'var(--ai-pink)' }} />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Amendments */}
        {hasAmendments && (
          <>
            <div
              className="px-4 pt-3 pb-2"
              style={hasComments ? { borderTop: '1px solid var(--ai-border-subtle)' } : undefined}
            >
              <span className="text-[11px] font-medium" style={{ color: 'var(--ai-text-tertiary)' }}>
                Amendments
                <span className="ml-1.5 font-normal" style={{ opacity: 0.7 }}>
                  {amendments.filter(a => !a.hidden).length} active
                  {amendments.filter(a => a.hidden).length > 0 &&
                    ` · ${amendments.filter(a => a.hidden).length} hidden`}
                </span>
              </span>
            </div>
            {amendments.map(a => {
              const phaseConf = pipeline.find(p => p.id === a.targetPhase)
              return (
                <div
                  key={a.id}
                  className="flex items-start gap-2.5 px-4 py-2.5"
                  style={{
                    borderTop: '1px solid var(--ai-border-subtle)',
                    opacity: a.hidden ? 0.5 : 1,
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono" style={{ color: 'var(--ai-text-tertiary)' }}>
                        {new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: 'var(--ai-surface-3)', color: 'var(--ai-text-tertiary)' }}
                      >
                        → {phaseConf?.name || a.targetPhase}
                      </span>
                      {a.hidden && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--ai-surface-3)', color: 'var(--ai-text-tertiary)' }}>
                          hidden
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-1 leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--ai-text-secondary)' }}>
                      {a.text}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => handleToggleHidden(a.id)}
                      className="p-1 rounded hover:bg-[var(--ai-surface-3)] transition-colors"
                      title={a.hidden ? 'Show to agents' : 'Hide from agents'}
                    >
                      {a.hidden
                        ? <Eye className="h-3 w-3" style={{ color: 'var(--ai-text-tertiary)' }} />
                        : <EyeOff className="h-3 w-3" style={{ color: 'var(--ai-text-tertiary)' }} />
                      }
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="p-1 rounded hover:bg-[var(--ai-surface-3)] transition-colors"
                      title="Delete amendment"
                    >
                      <Trash2 className="h-3 w-3" style={{ color: 'var(--ai-pink)' }} />
                    </button>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
