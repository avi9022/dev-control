import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Check } from 'lucide-react'

const priorityColors: Record<TodoPriority, string> = {
  high: 'bg-status-red',
  medium: 'bg-status-yellow',
  low: 'bg-blue-500',
  none: 'bg-muted'
}

const priorityLabels: Record<TodoPriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'None'
}

const priorities: TodoPriority[] = ['high', 'medium', 'low', 'none']

interface PrioritySelectorProps {
  currentPriority?: TodoPriority
  onSelect: (priority: TodoPriority) => void
  trigger?: React.ReactNode
  disabled?: boolean
}

export const PrioritySelector = ({ 
  currentPriority = 'none', 
  onSelect, 
  trigger,
  disabled 
}: PrioritySelectorProps) => {
  const defaultTrigger = (
    <button
      className={`
        flex-shrink-0 w-2.5 h-2.5 rounded-full transition-all hover:scale-125
        ${priorityColors[currentPriority]}
        ${disabled ? 'cursor-default opacity-50' : 'cursor-pointer'}
      `}
      title={`Priority: ${priorityLabels[currentPriority]}`}
      disabled={disabled}
    />
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        {trigger || defaultTrigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="start" 
        className="bg-neutral-800 border-neutral-700 min-w-[120px]"
      >
        {priorities.map((priority) => (
          <DropdownMenuItem
            key={priority}
            onClick={() => onSelect(priority)}
            className="flex items-center gap-2 text-sm text-neutral-200 hover:bg-neutral-700 cursor-pointer"
          >
            <div className={`w-2 h-2 rounded-full ${priorityColors[priority]}`} />
            <span className="flex-1">{priorityLabels[priority]}</span>
            {currentPriority === priority && (
              <Check size={14} className="text-blue-400" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

