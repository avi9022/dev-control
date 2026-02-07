import type { BrowserWindow } from 'electron'
import { v4 } from 'uuid'
import { ipcWebContentsSend } from '../utils/ipc-handle.js'
import { getWorkflowById } from '../storage/get-workflow-by-id.js'
import { store } from '../storage/store.js'
import { executeCommandStep, executeDockerStep, executeServiceStep } from './workflow-step-handlers.js'

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
    if (currentStatus === 'starting' || currentStatus === 'stopping') {
      throw new Error('Workflow is already executing')
    }

    const controller = new AbortController()
    this.activeExecutions.set(id, controller)
    this.setStatus(id, 'starting')

    const steps = workflow.startSteps.filter((s) => s.enabled)
    const progress = this.createProgress(id, 'starting', steps)
    this.broadcastProgress(progress)

    try {
      await this.executeSteps(workflow, steps, 'start', controller.signal, progress)
      this.setStatus(id, 'running')
      progress.status = 'running'
      this.broadcastProgress(progress)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      this.setStatus(id, 'error')
      progress.error = msg
      progress.status = 'error'
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
    this.setStatus(id, 'stopping')

    const steps = workflow.stopSteps.filter((s) => s.enabled)
    const progress = this.createProgress(id, 'stopping', steps)
    this.broadcastProgress(progress)

    try {
      await this.executeSteps(workflow, steps, 'stop', controller.signal, progress)
      this.setStatus(id, 'idle')
      progress.status = 'idle'
      this.broadcastProgress(progress)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      this.setStatus(id, 'error')
      progress.error = msg
      progress.status = 'error'
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
      this.setStatus(id, 'error')
    }
  }

  cancelAll(): void {
    for (const [id, controller] of this.activeExecutions.entries()) {
      controller.abort()
      this.setStatus(id, 'error')
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
      status: phase === 'starting' ? 'starting' : 'stopping',
      steps: steps.map((s) => ({
        stepId: s.id,
        status: 'pending' as WorkflowStepStatus,
        attempt: 0,
      })),
      startedAt: Date.now(),
    }
  }

  private async executeSteps(
    _workflow: EnhancedWorkflow,
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
          progress.steps[j] = { ...stepProgress, status: 'skipped' }
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
          status: 'running',
          attempt,
          startedAt: Date.now(),
        }
        this.broadcastProgress(progress)

        try {
          const onOutput = (data: string) => {
            progress.steps[i] = {
              ...progress.steps[i],
              output: ((progress.steps[i].output || '') + data).slice(-5000),
            }
            this.broadcastProgress(progress)
          }

          const handlerOptions = { signal, onOutput, mainWindow: this.mainWindow! }

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
            status: 'completed',
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
            await new Promise((r) => setTimeout(r, 1000))
          }
        }
      }

      if (lastError) {
        progress.steps[i] = {
          ...progress.steps[i],
          status: 'failed',
          message: lastError.message,
          completedAt: Date.now(),
        }
        this.broadcastProgress(progress)

        if (!step.continueOnError) {
          // Mark remaining as skipped
          for (let j = i + 1; j < steps.length; j++) {
            progress.steps[j] = { ...progress.steps[j], status: 'skipped' }
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
      status: progress.error ? 'failed' : 'completed',
      steps: progress.steps,
      startedAt: progress.startedAt,
      completedAt: Date.now(),
    }

    const history = store.get('workflowHistory') || {}
    const existingRecords = history[workflowId] || []
    const updatedRecords = [record, ...existingRecords].slice(0, 50)
    store.set('workflowHistory', { ...history, [workflowId]: updatedRecords })
  }

  getExecutionHistory(workflowId: string): WorkflowExecutionRecord[] {
    const history = store.get('workflowHistory') || {}
    return history[workflowId] || []
  }
}

export const workflowExecutor = new WorkflowExecutor()
