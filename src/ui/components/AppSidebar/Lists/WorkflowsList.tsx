import { type FC, useState } from 'react'
import { Separator } from '@/components/ui/separator'
import { useWorkflows } from '@/ui/contexts/workflows'
import { DeleteWorkflowButton } from '../../DialogButtons/DeleteWorkflowButton'
import { Button } from '@/components/ui/button'
import { Play, Square, Copy, Pencil } from 'lucide-react'
import { WorkflowStatusBadge } from '../../workflow/WorkflowStatusBadge'
import { WorkflowProgressPanel } from '../../workflow/WorkflowProgressPanel'
import { WorkflowHistoryDialog } from '../../workflow/WorkflowHistoryDialog'
import { WorkflowEditor } from '../../workflow/WorkflowEditor'

interface WorkflowsListProps {
  searchTerm: string
}

export const WorkflowsList: FC<WorkflowsListProps> = ({ searchTerm }) => {
  const { workflows, workflowStatusMap, activeProgress, startWorkflow, stopWorkflow } = useWorkflows()
  const [editingId, setEditingId] = useState<string | null>(null)

  const filteredList = searchTerm
    ? workflows.filter(({ name }) => name.toLowerCase().includes(searchTerm.toLowerCase()))
    : workflows

  const getStepSummary = (workflow: EnhancedWorkflow) => {
    const steps = workflow.startSteps
    const commands = steps.filter((s) => s.type === 'command').length
    const docker = steps.filter((s) => s.type === 'docker').length
    const services = steps.filter((s) => s.type === 'service').length
    const parts: string[] = []
    if (commands) parts.push(`${commands} command${commands > 1 ? 's' : ''}`)
    if (docker) parts.push(`${docker} docker`)
    if (services) parts.push(`${services} service${services > 1 ? 's' : ''}`)
    return parts.join(' · ') || 'No steps'
  }

  if (!workflows.length) {
    return (
      <div className="flex flex-col px-5 text-center gap-2 h-[400px] justify-center">
        <p>Looks like you have no workflows</p>
      </div>
    )
  }

  if (!filteredList.length) {
    return (
      <div className="flex flex-col px-5 text-center gap-2 h-[400px] justify-center">
        <p>No workflows to match the search</p>
      </div>
    )
  }

  return (
    <div>
      {filteredList.map(({ id, name }) => {
        const workflow = workflows.find((w) => w.id === id)!
        const status = workflowStatusMap[id]
        const hasProgress = !!activeProgress[id]
        const isRunning = status === 'running' || status === 'starting' || status === 'stopping'
        const canStart = !status || status === 'idle' || status === 'error'

        return (
          <div key={id}>
            <div className="px-4 py-3">
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold max-w-[200px] text-sm truncate">{name}</p>
                    <WorkflowStatusBadge status={status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {getStepSummary(workflow)}
                  </p>
                </div>
                <div className="flex gap-1 items-center shrink-0">
                  {canStart && (
                    <Button
                      onClick={(ev) => {
                        ev.stopPropagation()
                        startWorkflow(id)
                      }}
                      className="bg-success hover:bg-success/80 cursor-pointer h-7 w-7 p-0"
                      size="sm"
                      title="Start"
                    >
                      <Play fill="white" color="white" className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {isRunning && (
                    <Button
                      onClick={(ev) => {
                        ev.stopPropagation()
                        stopWorkflow(id)
                      }}
                      variant="destructive"
                      className="h-7 w-7 p-0"
                      size="sm"
                      title="Stop"
                    >
                      <Square fill="white" color="white" className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setEditingId(id)}
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => window.electron.duplicateWorkflow(id)}
                    title="Duplicate"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <WorkflowHistoryDialog workflowId={id} workflowName={name} />
                  <DeleteWorkflowButton id={id} />
                </div>
              </div>

              {hasProgress && <WorkflowProgressPanel workflowId={id} />}
            </div>
            <Separator />
          </div>
        )
      })}

      <WorkflowEditor
        open={!!editingId}
        onOpenChange={(open) => { if (!open) setEditingId(null) }}
        workflowId={editingId}
      />
    </div>
  )
}
