import { type FC } from 'react'
import { Trash2 } from 'lucide-react'
import { CONVERSATION_LIST_TRUNCATE_LENGTH, formatRelativeTime } from '@/ui/components/ai-automation/planner-constants'

interface PlannerConversationListProps {
  conversations: PlannerConversationListItem[]
  currentSessionId: string
  onLoad: (sessionId: string) => void
  onDelete: (sessionId: string) => void
}

export const PlannerConversationList: FC<PlannerConversationListProps> = ({
  conversations,
  currentSessionId,
  onLoad,
  onDelete,
}) => {
  if (conversations.length === 0) {
    return (
      <div className="px-3 py-8 text-center text-xs" style={{ color: 'var(--ai-text-tertiary)' }}>
        No saved conversations
      </div>
    )
  }

  return (
    <div>
      {conversations.map(conv => {
        const isActive = conv.sessionId === currentSessionId
        return (
          <div
            key={conv.sessionId}
            className="group w-full text-left px-3 py-2 cursor-pointer transition-colors hover:bg-[var(--ai-surface-2)]"
            style={{
              background: isActive ? 'var(--ai-surface-2)' : 'transparent',
              borderBottom: '1px solid var(--ai-border-subtle)',
            }}
            onClick={() => onLoad(conv.sessionId)}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs truncate block" style={{ color: isActive ? 'var(--ai-text-primary)' : 'var(--ai-text-secondary)' }}>
                {conv.firstMessage.length > CONVERSATION_LIST_TRUNCATE_LENGTH
                  ? conv.firstMessage.slice(0, CONVERSATION_LIST_TRUNCATE_LENGTH) + '...'
                  : conv.firstMessage}
              </span>
              <span className="text-[10px] flex-shrink-0 flex items-center gap-1" style={{ color: 'var(--ai-text-tertiary)' }}>
                <span>{formatRelativeTime(conv.updatedAt)}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-[var(--ai-surface-3)]"
                  onClick={(e) => { e.stopPropagation(); onDelete(conv.sessionId) }}
                  style={{ color: 'var(--ai-text-tertiary)' }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
