import { useState, useEffect, useRef, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { MessageSquare, X, CircleCheck } from 'lucide-react'
import { RESOLVER } from '@/shared/constants'

/** Displays a single inline comment with optional delete/resolve controls */
export const InlineComment: FC<{
  comment: AIHumanComment
  onDelete?: () => void
  onToggleResolved?: () => void
}> = ({ comment, onDelete, onToggleResolved }) => {
  const agentResolved = comment.resolvedBy?.includes(RESOLVER.AGENT) && !comment.resolved
  return (
  <div
    className="flex items-start gap-2 mx-2 my-1 p-2 rounded border"
    style={agentResolved
      ? { background: 'var(--ai-purple-subtle)', borderColor: 'var(--ai-purple-subtle)' }
      : comment.resolved
        ? { background: 'var(--ai-surface-2)', borderColor: 'var(--ai-border-subtle)' }
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
        className={`text-xs whitespace-pre-wrap ${comment.resolved ? 'line-through' : ''}`}
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

/** Comment input form with textarea and submit/cancel */
export const CommentInput: FC<{
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
