import { type FC } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Trash2, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MessagesPanelProps {
  messages: SQLMessage[]
  onClear: () => void
}

const iconMap = {
  error: AlertCircle,
  success: CheckCircle,
  warning: AlertTriangle,
  info: Info,
}

const colorMap = {
  error: 'text-red-400',
  success: 'text-green-400',
  warning: 'text-amber-400',
  info: 'text-blue-400',
}

export const MessagesPanel: FC<MessagesPanelProps> = ({ messages, onClear }) => {
  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No messages
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1 border-b border-border">
        <span className="text-xs text-muted-foreground">{messages.length} message{messages.length !== 1 ? 's' : ''}</span>
        <Button variant="ghost" size="sm" className="h-5 px-1.5" onClick={onClear}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {messages.map((msg) => {
            const Icon = iconMap[msg.type]
            return (
              <div key={msg.id} className="flex items-start gap-2 px-2 py-1 text-xs rounded hover:bg-[#1e1f23]">
                <Icon className={cn('h-3.5 w-3.5 flex-shrink-0 mt-0.5', colorMap[msg.type])} />
                <span className="flex-1 font-mono">{msg.text}</span>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
