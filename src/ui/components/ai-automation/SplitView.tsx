import { type FC } from 'react'
import { Plus } from 'lucide-react'
import { type DiffFile, buildSplitPairs, commentKey } from './diff-parser'
import { InlineComment, CommentInput } from './InlineComment'

export const SplitView: FC<{
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
