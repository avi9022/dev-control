import { type FC, useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { WorkflowStepList } from './WorkflowStepList'
import { useWorkflows } from '@/ui/contexts/workflows'
import { toast } from 'sonner'
import { RotateCcw } from 'lucide-react'

interface WorkflowEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workflowId?: string | null
}

function buildStepSummary(steps: WorkflowStep[]): string {
  const commands = steps.filter((s) => s.type === 'command').length
  const docker = steps.filter((s) => s.type === 'docker').length
  const services = steps.filter((s) => s.type === 'service').length
  const parts: string[] = []
  if (commands) parts.push(`${commands} cmd`)
  if (docker) parts.push(`${docker} docker`)
  if (services) parts.push(`${services} svc`)
  return parts.join(' / ') || 'empty'
}

function generateStopSteps(startSteps: WorkflowStep[]): WorkflowStep[] {
  return [...startSteps].reverse().map((step) => {
    switch (step.type) {
      case 'service':
        return { ...step, label: step.label.replace(/^Start/, 'Stop').replace(/^start/, 'stop') }
      case 'docker':
        return { ...step, label: step.label.replace(/^Start/, 'Stop').replace(/^start/, 'stop') }
      case 'command':
        return { ...step, label: `Reverse: ${step.label}` }
      default:
        return step
    }
  })
}

export const WorkflowEditor: FC<WorkflowEditorProps> = ({
  open,
  onOpenChange,
  workflowId,
}) => {
  const { getWorkflowById } = useWorkflows()
  const workflow = workflowId ? getWorkflowById(workflowId) : null

  const [name, setName] = useState('')
  const [startSteps, setStartSteps] = useState<WorkflowStep[]>([])
  const [stopSteps, setStopSteps] = useState<WorkflowStep[]>([])

  useEffect(() => {
    if (open) {
      if (workflow) {
        setName(workflow.name)
        setStartSteps(workflow.startSteps)
        setStopSteps(workflow.stopSteps)
      } else {
        setName('')
        setStartSteps([])
        setStopSteps([])
      }
    }
  }, [open, workflow])

  const handleAutoGenerateStopSteps = () => {
    setStopSteps(generateStopSteps(startSteps))
  }

  const handleSave = () => {
    if (name.trim().length < 2) {
      toast.error('Workflow name must be at least 2 characters')
      return
    }

    const data = { name: name.trim(), startSteps, stopSteps }

    if (workflowId) {
      window.electron.updateWorkflow(workflowId, data)
      toast.success(`Workflow '${name}' updated`)
    } else {
      window.electron.createWorkflow(data)
      toast.success(`Workflow '${name}' created`)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{workflow ? `Edit: ${workflow.name}` : 'New Workflow'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 min-h-0">
          <div>
            <Label className="text-xs mb-1.5">Workflow Name</Label>
            <Input
              placeholder="My Workflow"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8"
            />
          </div>

          <Tabs defaultValue="start" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="start">
                Start Flow ({buildStepSummary(startSteps)})
              </TabsTrigger>
              <TabsTrigger value="stop">
                Stop Flow ({buildStepSummary(stopSteps)})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="start">
              <ScrollArea className="h-[350px] pr-3">
                <WorkflowStepList steps={startSteps} onStepsChange={setStartSteps} />
              </ScrollArea>
            </TabsContent>

            <TabsContent value="stop">
              <div className="mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAutoGenerateStopSteps}
                  disabled={startSteps.length === 0}
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> Auto-generate from Start
                </Button>
              </div>
              <ScrollArea className="h-[320px] pr-3">
                <WorkflowStepList steps={stopSteps} onStepsChange={setStopSteps} />
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={name.trim().length < 2}>
            {workflow ? 'Save Changes' : 'Create Workflow'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
