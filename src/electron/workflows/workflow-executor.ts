import type { BrowserWindow } from 'electron'
import { v4 } from 'uuid'
import { ipcWebContentsSend } from '../utils/ipc-handle.js'
import { getWorkflowById } from '../storage/get-workflow-by-id.js'
import { store } from '../storage/store.js'
import { executeCommandStep, executeDockerStep, executeServiceStep } from './workflow-step-handlers.js'
import { WorkflowStatus, WorkflowStepStatus, WorkflowRecordStatus, WORKFLOW_RETRY_DELAY_MS } from '../../shared/constants.js'

const MAX_STEP_OUTPUT_LENGTH = 5_000
const MAX_HISTORY_RECORDS = 50

export class WorkflowExecutor {
  private activeExecutions = new Map<string, AbortController>()
  private statusMap = new Map<string, WorkflowStatus>()
  private mainWindow: BrowserWindow | null = null

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  getStatusMap(): Record<string, WorkflowStatus> {
    return Object.fromEntries(this.statusMap)
  }

  private broadcastStatusMap(): void {
    if (!this.mainWindow) return
    ipcWebContentsSend(
      'workflowStatusMap',
      this.mainWindow.webContents,
      Object.fromEntries(this.statusMap)
    )
  }

  private broadcastProgress(progress: WorkflowExecutionProgress): void {
    if (!this.mainWindow) return
    ipcWebContentsSend('workflowProgress', this.mainWindow.webContents, progress)
  }

  private setStatus(workflowId: string, status: WorkflowStatus): void {
    this.statusMap.set(workflowId, status)
    this.broadcastStatusMap()
  }

  async startWorkflow(id: string): Promise<void> {
    const workflow = getWorkflowById(id)
    if (!workflow) throw new Error('Workflow not found')

    const currentStatus = this.statusMap.get(id)
    if (currentStatus === WorkflowStatus.Starting || currentStatus === WorkflowStatus.Stopping) {
      throw new Error('Workflow is already executing')
    }

    const controller = new AbortController()
    this.activeExecutions.set(id, controller)
    this.setStatus(id, WorkflowStatus.Starting)

    const steps = workflow.startSteps.filter((s) => s.enabled)
    const progress = this.createProgress(id, 'starting', steps)
    this.broadcastProgress(progress)

    try {
      await this.executeSteps(steps, 'start', controller.signal, progress)
      this.setStatus(id, WorkflowStatus.Running)
      progress.status = WorkflowStatus.Running
      this.broadcastProgress(progress)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      this.setStatus(id, WorkflowStatus.Error)
      progress.error = msg
      progress.status = WorkflowStatus.Error
      this.broadcastProgress(progress)
    } finally {
      this.activeExecutions.delete(id)
      this.saveExecutionRecord(id, workflow.name, 'start', progress)
    }
  }

  async stopWorkflow(id: string): Promise<void> {
    const workflow = getWorkflowById(id)
    if (!workflow) throw new Error('Workflow not found')

    // Cancel any running start execution first
    const existingController = this.activeExecutions.get(id)
    if (existingController) {
      existingController.abort()
      this.activeExecutions.delete(id)
    }

    const controller = new AbortController()
    this.activeExecutions.set(id, controller)
    this.setStatus(id, WorkflowStatus.Stopping)

    const steps = workflow.stopSteps.filter((s) => s.enabled)
    const progress = this.createProgress(id, 'stopping', steps)
    this.broadcastProgress(progress)

    try {
      await this.executeSteps(steps, 'stop', controller.signal, progress)
      this.setStatus(id, WorkflowStatus.Idle)
      progress.status = WorkflowStatus.Idle
      this.broadcastProgress(progress)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      this.setStatus(id, WorkflowStatus.Error)
      progress.error = msg
      progress.status = WorkflowStatus.Error
      this.broadcastProgress(progress)
    } finally {
      this.activeExecutions.delete(id)
      this.saveExecutionRecord(id, workflow.name, 'stop', progress)
    }
  }

  cancelWorkflow(id: string): void {
    const controller = this.activeExecutions.get(id)
    if (controller) {
      controller.abort()
      this.activeExecutions.delete(id)
      this.setStatus(id, WorkflowStatus.Error)
    }
  }

  cancelAll(): void {
    for (const [id, controller] of this.activeExecutions.entries()) {
      controller.abort()
      this.setStatus(id, WorkflowStatus.Error)
    }
    this.activeExecutions.clear()
  }

  private createProgress(
    workflowId: string,
    phase: 'starting' | 'stopping',
    steps: WorkflowStep[]
  ): WorkflowExecutionProgress {
    return {
      workflowId,
      phase,
      status: phase === 'starting' ? WorkflowStatus.Starting : WorkflowStatus.Stopping,
      steps: steps.map((s) => ({
        stepId: s.id,
        status: WorkflowStepStatus.Pending,
        attempt: 0,
      })),
      startedAt: Date.now(),
    }
  }

  private async executeSteps(
    steps: WorkflowStep[],
    phase: 'start' | 'stop',
    signal: AbortSignal,
    progress: WorkflowExecutionProgress
  ): Promise<void> {
    if (!this.mainWindow) throw new Error('Main window not available')

    for (let i = 0; i < steps.length; i++) {
      if (signal.aborted) {
        // Mark remaining as skipped
        for (let j = i; j < steps.length; j++) {
          const stepProgress = progress.steps[j]
          progress.steps[j] = { ...stepProgress, status: WorkflowStepStatus.Skipped }
        }
        this.broadcastProgress(progress)
        throw new Error('Workflow cancelled')
      }

      const step = steps[i]
      const stepProgress = progress.steps[i]
      let lastError: Error | null = null
      const maxAttempts = step.retries + 1

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        progress.steps[i] = {
          ...stepProgress,
          status: WorkflowStepStatus.Running,
          attempt,
          startedAt: Date.now(),
        }
        this.broadcastProgress(progress)

        try {
          const onOutput = (data: string): void => {
            progress.steps[i] = {
              ...progress.steps[i],
              output: ((progress.steps[i].output || '') + data).slice(-MAX_STEP_OUTPUT_LENGTH),
            }
            this.broadcastProgress(progress)
          }

          const handlerOptions = { signal, onOutput, mainWindow: this.mainWindow }

          switch (step.type) {
            case 'command':
              await executeCommandStep(step, handlerOptions)
              break
            case 'docker':
              await executeDockerStep(step, phase, handlerOptions)
              break
            case 'service':
              await executeServiceStep(step, phase, handlerOptions)
              break
          }

          // Success
          progress.steps[i] = {
            ...progress.steps[i],
            status: WorkflowStepStatus.Completed,
            completedAt: Date.now(),
          }
          this.broadcastProgress(progress)
          lastError = null
          break
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))

          if (attempt < maxAttempts && !signal.aborted) {
            progress.steps[i] = {
              ...progress.steps[i],
              message: `Attempt ${attempt} failed: ${lastError.message}. Retrying...`,
            }
            this.broadcastProgress(progress)
            await new Promise((r) => setTimeout(r, WORKFLOW_RETRY_DELAY_MS))
          }
        }
      }

      if (lastError) {
        progress.steps[i] = {
          ...progress.steps[i],
          status: WorkflowStepStatus.Failed,
          message: lastError.message,
          completedAt: Date.now(),
        }
        this.broadcastProgress(progress)

        if (!step.continueOnError) {
          // Mark remaining as skipped
          for (let j = i + 1; j < steps.length; j++) {
            progress.steps[j] = { ...progress.steps[j], status: WorkflowStepStatus.Skipped }
          }
          this.broadcastProgress(progress)
          throw lastError
        }
      }
    }
  }

  private saveExecutionRecord(
    workflowId: string,
    workflowName: string,
    phase: 'start' | 'stop',
    progress: WorkflowExecutionProgress
  ): void {
    const record: WorkflowExecutionRecord = {
      id: v4(),
      workflowId,
      workflowName,
      phase,
      status: progress.error ? WorkflowRecordStatus.Failed : WorkflowRecordStatus.Completed,
      steps: progress.steps,
      startedAt: progress.startedAt,
      completedAt: Date.now(),
    }

    const history = store.get('workflowHistory') || {}
    const existingRecords = history[workflowId] || []
    const updatedRecords = [record, ...existingRecords].slice(0, MAX_HISTORY_RECORDS)
    store.set('workflowHistory', { ...history, [workflowId]: updatedRecords })
  }

  getExecutionHistory(workflowId: string): WorkflowExecutionRecord[] {
    const history = store.get('workflowHistory') || {}
    return history[workflowId] || []
  }
}

export const workflowExecutor = new WorkflowExecutor()
