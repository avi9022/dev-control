import { type FC, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { WorkflowStepItem } from './WorkflowStepItem'
import { WorkflowStepForm } from './WorkflowStepForm'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

interface WorkflowStepListProps {
  steps: WorkflowStep[]
  onStepsChange: (steps: WorkflowStep[]) => void
}

export const WorkflowStepList: FC<WorkflowStepListProps> = ({ steps, onStepsChange }) => {
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null)
  const [showForm, setShowForm] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = steps.findIndex((s) => s.id === active.id)
    const newIndex = steps.findIndex((s) => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = [...steps]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)
    onStepsChange(reordered)
  }

  const handleSaveStep = (step: WorkflowStep) => {
    if (editingStep) {
      onStepsChange(steps.map((s) => (s.id === step.id ? step : s)))
    } else {
      onStepsChange([...steps, step])
    }
    setEditingStep(null)
    setShowForm(false)
  }

  const handleDeleteStep = (stepId: string) => {
    onStepsChange(steps.filter((s) => s.id !== stepId))
  }

  const handleToggleEnabled = (stepId: string, enabled: boolean) => {
    onStepsChange(steps.map((s) => (s.id === stepId ? { ...s, enabled } : s)))
  }

  return (
    <div className="space-y-2 overflow-x-hidden">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {steps.map((step) => (
            <WorkflowStepItem
              key={step.id}
              step={step}
              onEdit={() => {
                setEditingStep(step)
                setShowForm(true)
              }}
              onDelete={() => handleDeleteStep(step.id)}
              onToggleEnabled={(enabled) => handleToggleEnabled(step.id, enabled)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {steps.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-6">No steps yet. Add one below.</p>
      )}

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => {
          setEditingStep(null)
          setShowForm(true)
        }}
      >
        <Plus className="h-3 w-3 mr-1" /> Add Step
      </Button>

      <WorkflowStepForm
        open={showForm}
        onOpenChange={setShowForm}
        step={editingStep}
        onSave={handleSaveStep}
      />
    </div>
  )
}
