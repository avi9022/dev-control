import { type FC } from 'react'
import { type ChatMessage } from './chat-parser'

interface ToolCallRowProps {
  message: ChatMessage
}

export const ToolCallRow: FC<ToolCallRowProps> = ({ message }) => {
  return (
    <div
      className="px-4 py-0.5 text-xs ml-4"
      style={{ color: 'var(--ai-text-tertiary)', fontFamily: 'var(--ai-mono)' }}
    >
      🔧 {message.content}
    </div>
  )
}
