import { type FC } from 'react'
import { MarkdownViewer } from '@/ui/components/ai-automation/MarkdownViewer'
import { type ChatMessage, ChatMessageType } from './chat-parser'

const BUBBLE_MAX_WIDTH = '80%'

interface ChatBubbleProps {
  message: ChatMessage
}

export const ChatBubble: FC<ChatBubbleProps> = ({ message }) => {
  const isUser = message.type === ChatMessageType.UserMessage

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} px-4 py-1.5`}>
      <div
        className="rounded-lg px-3.5 py-2.5 text-sm"
        style={{
          maxWidth: BUBBLE_MAX_WIDTH,
          background: isUser ? 'var(--ai-accent-subtle)' : 'var(--ai-surface-1)',
          color: 'var(--ai-text-primary)',
        }}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          <MarkdownViewer content={message.content} />
        )}
      </div>
    </div>
  )
}
