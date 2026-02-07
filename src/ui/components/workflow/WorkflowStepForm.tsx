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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { CommandStepFields } from './CommandStepFields'
import { DockerStepFields } from './DockerStepFields'
import { ServiceStepFields } from './ServiceStepFields'
import { v4 } from 'uuid'
import { useDirectories } from '@/ui/contexts/directories'

interface WorkflowStepFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  step?: WorkflowStep | null
  onSave: (step: WorkflowStep) => void
}

const DEFAULT_TIMEOUTS: Record<WorkflowStepType, number> = {
  command: 60000,
  docker: 120000,
  service: 120000,
}

function summarizeNames(names: string[], max = 2): string {
  if (names.length <= max) return names.join(', ')
  return `${names.slice(0, max).join(', ')} +${names.length - max} more`
}

function getDefaultLabel(
  type: WorkflowStepType,
  command: string,
  containerNames: string[],
  serviceIds: string[],
  directories: DirectorySettings[],
  composeProject?: string
): string {
  switch (type) {
    case 'command':
      return command.slice(0, 50) || 'Run command'
    case 'docker':
      if (composeProject) return `Compose: ${composeProject}`
      return containerNames.length ? summarizeNames(containerNames) : 'Docker containers'
    case 'service': {
      const names = serviceIds
        .map((id) => directories.find((d) => d.id === id)?.name)
        .filter((n): n is string => !!n)
      return names.length ? summarizeNames(names) : 'Services'
    }
  }
}

function isStepValid(
  type: WorkflowStepType,
  command: string,
  containerIds: string[],
  serviceIds: string[],
  composeProject?: string
): boolean {
  switch (type) {
    case 'command':
      return command.trim().length > 0
    case 'docker':
      return !!composeProject || containerIds.length > 0
    case 'service':
      return serviceIds.length > 0
  }
}

export const WorkflowStepForm: FC<WorkflowStepFormProps> = ({
  open,
  onOpenChange,
  step,
  onSave,
}) => {
  const [type, setType] = useState<WorkflowStepType>(step?.type || 'command')
  const [label, setLabel] = useState(step?.label || '')
  const [enabled, setEnabled] = useState(step?.enabled ?? true)
  const [timeoutMs, setTimeoutMs] = useState(step?.timeoutMs ?? DEFAULT_TIMEOUTS[type])
  const [retries, setRetries] = useState(step?.retries ?? 0)
  const [continueOnError, setContinueOnError] = useState(step?.continueOnError ?? false)

  const [command, setCommand] = useState(step?.type === 'command' ? step.command : '')
  const [workingDirectory, setWorkingDirectory] = useState(
    step?.type === 'command' ? step.workingDirectory || '' : ''
  )

  const [containerIds, setContainerIds] = useState<string[]>(
    step?.type === 'docker' ? step.containerIds : []
  )
  const [containerNames, setContainerNames] = useState<string[]>(
    step?.type === 'docker' ? step.containerNames : []
  )
  const [composeProject, setComposeProject] = useState<string | undefined>(
    step?.type === 'docker' ? step.composeProject : undefined
  )
  const [dockerContext, setDockerContext] = useState<string | undefined>(
    step?.type === 'docker' ? step.dockerContext : undefined
  )

  const [serviceIds, setServiceIds] = useState<string[]>(
    step?.type === 'service' ? step.serviceIds : []
  )

  const { directories } = useDirectories()

  useEffect(() => {
    if (step) {
      setType(step.type)
      setLabel(step.label)
      setEnabled(step.enabled)
      setTimeoutMs(step.timeoutMs)
      setRetries(step.retries)
      setContinueOnError(step.continueOnError)
      if (step.type === 'command') {
        setCommand(step.command)
        setWorkingDirectory(step.workingDirectory || '')
      }
      if (step.type === 'docker') {
        setContainerIds(step.containerIds)
        setContainerNames(step.containerNames)
        setComposeProject(step.composeProject)
        setDockerContext(step.dockerContext)
      }
      if (step.type === 'service') {
        setServiceIds(step.serviceIds)
      }
    } else {
      setType('command')
      setLabel('')
      setEnabled(true)
      setTimeoutMs(DEFAULT_TIMEOUTS.command)
      setRetries(0)
      setContinueOnError(false)
      setCommand('')
      setWorkingDirectory('')
      setContainerIds([])
      setContainerNames([])
      setComposeProject(undefined)
      setDockerContext(undefined)
      setServiceIds([])
    }
  }, [step, open])

  const handleTypeChange = (newType: WorkflowStepType) => {
    setType(newType)
    setTimeoutMs(DEFAULT_TIMEOUTS[newType])
  }

  const handleSave = () => {
    const base = {
      id: step?.id || v4(),
      label: label || getDefaultLabel(type, command, containerNames, serviceIds, directories, composeProject),
      enabled,
      timeoutMs,
      retries,
      continueOnError,
    }

    let newStep: WorkflowStep
    switch (type) {
      case 'command':
        newStep = { ...base, type: 'command', command, workingDirectory: workingDirectory || undefined }
        break
      case 'docker':
        newStep = { ...base, type: 'docker', containerIds, containerNames, composeProject, dockerContext }
        break
      case 'service':
        newStep = { ...base, type: 'service', serviceIds }
        break
    }

    onSave(newStep)
    onOpenChange(false)
  }

  const defaultLabel = getDefaultLabel(type, command, containerNames, serviceIds, directories, composeProject)
  const valid = isStepValid(type, command, containerIds, serviceIds, composeProject)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{step ? 'Edit Step' : 'Add Step'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
          <div>
            <Label className="text-xs mb-1.5">Step Type</Label>
            <Select value={type} onValueChange={(v) => handleTypeChange(v as WorkflowStepType)}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="command">Command</SelectItem>
                <SelectItem value="docker">Docker Containers</SelectItem>
                <SelectItem value="service">Services</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs mb-1.5">Label</Label>
            <Input
              placeholder={defaultLabel}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {type === 'command' && (
            <CommandStepFields
              command={command}
              workingDirectory={workingDirectory}
              onCommandChange={setCommand}
              onWorkingDirectoryChange={setWorkingDirectory}
            />
          )}

          {type === 'docker' && (
            <DockerStepFields
              containerIds={containerIds}
              containerNames={containerNames}
              composeProject={composeProject}
              dockerContext={dockerContext}
              onContainersChange={(ids, names) => {
                setContainerIds(ids)
                setContainerNames(names)
              }}
              onComposeProjectChange={setComposeProject}
              onDockerContextChange={setDockerContext}
            />
          )}

          {type === 'service' && (
            <ServiceStepFields serviceIds={serviceIds} onServiceIdsChange={setServiceIds} />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1.5">Timeout (seconds)</Label>
              <Input
                type="number"
                value={Math.round(timeoutMs / 1000)}
                onChange={(e) => setTimeoutMs(Number(e.target.value) * 1000)}
                className="h-8 text-sm"
                min={1}
              />
            </div>
            <div>
              <Label className="text-xs mb-1.5">Retries</Label>
              <Input
                type="number"
                value={retries}
                onChange={(e) => setRetries(Number(e.target.value))}
                className="h-8 text-sm"
                min={0}
                max={10}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">Continue on Error</Label>
            <Switch checked={continueOnError} onCheckedChange={setContinueOnError} />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">Enabled</Label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!valid}>
            {step ? 'Update' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
