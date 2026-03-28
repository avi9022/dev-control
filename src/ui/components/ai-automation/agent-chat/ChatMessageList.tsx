import { useEffect, useRef, type FC } from 'react'
import { type ChatMessage, ChatMessageType } from './chat-parser'
import { ChatBubble } from './ChatBubble'
import { ToolCallRow } from './ToolCallRow'
import { SystemEvent } from './SystemEvent'

interface ChatMessageListProps {
  messages: ChatMessage[]
  showToolCalls: boolean
  autoScroll: boolean
}

export const ChatMessageList: FC<ChatMessageListProps> = ({ messages, showToolCalls, autoScroll }) => {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, autoScroll])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-sm" style={{ color: 'var(--ai-text-tertiary)' }}>
          Waiting for agent output...
        </span>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto py-3">
      {messages.map((message) => {
        if (message.type === ChatMessageType.ToolCall && !showToolCalls) return null

        switch (message.type) {
          case ChatMessageType.AgentText:
          case ChatMessageType.UserMessage:
            return <ChatBubble key={message.id} message={message} />
          case ChatMessageType.ToolCall:
            return <ToolCallRow key={message.id} message={message} />
          case ChatMessageType.System:
            return <SystemEvent key={message.id} message={message} />
          case ChatMessageType.Error:
            return (
              <div
                key={message.id}
                className="mx-4 my-1.5 px-3.5 py-2 rounded-lg text-sm"
                style={{ background: 'var(--ai-error-subtle)', color: 'var(--ai-error)' }}
              >
                {message.content}
              </div>
            )
          default:
            return null
        }
      })}
    </div>
  )
}
