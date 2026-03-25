import { type FC, type RefObject } from 'react'
import { MarkdownViewer } from './MarkdownViewer'
import { LOADING_DOT_SIZE } from '@/ui/components/ai-automation/planner-constants'

const LoadingDots: FC = () => {
  return (
    <div className="flex items-center gap-1.5 px-1 py-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className={`${LOADING_DOT_SIZE} rounded-full inline-block`}
          style={{
            background: 'var(--ai-accent)',
            opacity: 0.4,
            animation: `plannerDotPulse 1.4s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes plannerDotPulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

interface PlannerMessageListProps {
  messages: PlannerChatMessage[]
  isLoading: boolean
  messagesEndRef: RefObject<HTMLDivElement | null>
}

export const PlannerMessageList: FC<PlannerMessageListProps> = ({ messages, isLoading, messagesEndRef }) => {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
      {messages.filter(m => !(m.role === 'user' && m.content === 'Hi, I want to plan some tasks.')).map((msg, i) => (
        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
              msg.role === 'user' ? 'rounded-br-sm whitespace-pre-wrap' : 'rounded-bl-sm'
            }`}
            style={{
              background: msg.role === 'user' ? 'var(--ai-accent-subtle)' : 'var(--ai-surface-2)',
              color: 'var(--ai-text-primary)',
            }}
          >
            {msg.role === 'assistant' ? (
              <MarkdownViewer content={msg.content} className="text-sm" />
            ) : (
              msg.content
            )}
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="flex justify-start">
          <div
            className="rounded-lg rounded-bl-sm px-4 py-3"
            style={{ background: 'var(--ai-surface-2)' }}
          >
            <LoadingDots />
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  )
}
