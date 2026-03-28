import { type FC } from 'react'
import { type ChatMessage } from './chat-parser'

interface SystemEventProps {
  message: ChatMessage
}

export const SystemEvent: FC<SystemEventProps> = ({ message }) => {
  return (
    <div className="flex justify-center px-4 py-1.5">
      <span
        className="text-xs px-2.5 py-0.5 rounded-full"
        style={{ color: 'var(--ai-text-tertiary)', background: 'var(--ai-surface-1)' }}
      >
        {message.content}
      </span>
    </div>
  )
}
