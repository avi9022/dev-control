import { type FC } from 'react'
import { Plus } from 'lucide-react'
import { type DiffLine, commentKey } from './diff-parser'
import { InlineComment, CommentInput } from './InlineComment'

/** A single diff line row with comment gutter button */
export const DiffLineRow: FC<{
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
