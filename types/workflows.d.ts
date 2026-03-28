interface Workflow {
  name: string
  id: string
  services: string[]
}

// ─── Enhanced Workflow Types ───
type WorkflowStepType = 'command' | 'docker' | 'service'

interface WorkflowStepBase {
  id: string
  type: WorkflowStepType
  label: string
  enabled: boolean
  timeoutMs: number
  retries: number
  continueOnError: boolean
}

interface WorkflowCommandStep extends WorkflowStepBase {
  type: 'command'
  command: string
  workingDirectory?: string
}

interface WorkflowDockerStep extends WorkflowStepBase {
  type: 'docker'
  containerIds: string[]
  containerNames: string[]
  composeProject?: string
  dockerContext?: string
}

interface WorkflowServiceStep extends WorkflowStepBase {
  type: 'service'
  serviceIds: string[]
}

type WorkflowStep = WorkflowCommandStep | WorkflowDockerStep | WorkflowServiceStep

type WorkflowStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'partial' | 'error'

interface EnhancedWorkflow {
  id: string
  name: string
  startSteps: WorkflowStep[]
  stopSteps: WorkflowStep[]
  createdAt: number
  updatedAt: number
}

type WorkflowStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

interface WorkflowStepProgress {
  stepId: string
  status: WorkflowStepStatus
  message?: string
  output?: string
  startedAt?: number
  completedAt?: number
  attempt: number
}

interface WorkflowExecutionProgress {
  workflowId: string
  phase: 'starting' | 'stopping'
  status: WorkflowStatus
  steps: WorkflowStepProgress[]
  startedAt: number
  error?: string
}

interface WorkflowExecutionRecord {
  id: string
  workflowId: string
  workflowName: string
  phase: 'start' | 'stop'
  status: 'completed' | 'failed' | 'cancelled'
  steps: WorkflowStepProgress[]
  startedAt: number
  completedAt: number
}
