import { type FC } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { GripVertical, Pencil, Trash2, Terminal, Container, Server } from 'lucide-react'

interface WorkflowStepItemProps {
  step: WorkflowStep
  onEdit: () => void
  onDelete: () => void
  onToggleEnabled: (enabled: boolean) => void
}

const stepTypeIcons: Record<WorkflowStepType, typeof Terminal> = {
  command: Terminal,
  docker: Container,
  service: Server,
}

function getStepTypeLabel(step: WorkflowStep): string {
  switch (step.type) {
    case 'command': return 'Command'
    case 'docker':
      if (step.composeProject) return 'Compose'
      return step.containerIds.length > 1 ? 'Containers' : 'Container'
    case 'service':
      return step.serviceIds.length > 1 ? 'Services' : 'Service'
  }
}

export const WorkflowStepItem: FC<WorkflowStepItemProps> = ({
  step,
  onEdit,
  onDelete,
  onToggleEnabled,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : step.enabled ? 1 : 0.5,
  }

  const Icon = stepTypeIcons[step.type]

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-2 py-2 mb-1 bg-muted/30 rounded border border-border/50 group overflow-hidden min-w-0"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-1.5 shrink-0 min-w-[80px]">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] uppercase text-muted-foreground font-medium">
          {getStepTypeLabel(step)}
        </span>
      </div>

      <span className="text-sm w-0 flex-1 truncate" title={step.label}>{step.label}</span>

      {step.retries > 0 && (
        <span className="text-[10px] text-muted-foreground shrink-0">
          {step.retries}x retry
        </span>
      )}

      {step.continueOnError && (
        <span className="text-[10px] text-yellow-500 shrink-0">skip-err</span>
      )}

      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Switch
          checked={step.enabled}
          onCheckedChange={onToggleEnabled}
          className="scale-75"
        />
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onEdit}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={onDelete}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
