import { randomUUID } from 'crypto'
import { type BrowserWindow } from 'electron'
import { createTask } from '../task-manager.js'
import { ipcWebContentsSend } from '../../utils/ipc-handle.js'
import { type McpToolDefinition, type McpToolResult, textResult, errorResult } from './types.js'
import { GIT_STRATEGY } from '../../../shared/constants.js'

const STEPPER_TIMEOUT_MS = 55_000

interface TaskInput {
  title: string
  description: string
  projectPaths?: string
}

interface CreatedTaskResult {
  id: string
  title: string
}

interface FailedTaskResult {
  title: string
  error: string
}

interface PendingStepperRequest {
  resolve: (result: TaskStepperResponse) => void
  timer: NodeJS.Timeout
}

let mainWindow: BrowserWindow | null = null
const pendingRequests = new Map<string, PendingStepperRequest>()

function isValidTaskInput(item: unknown): item is TaskInput {
  if (typeof item !== 'object' || item === null) return false
  return 'title' in item && typeof item.title === 'string' &&
    'description' in item && typeof item.description === 'string'
}

function parseTasksJson(json: string): TaskInput[] {
  let parsed: unknown[]
  try {
    const result = JSON.parse(json)
    if (!Array.isArray(result)) {
      throw new Error('tasks must be a JSON array')
    }
    parsed = result
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Invalid JSON in tasks parameter')
  }

  const validated: TaskInput[] = []
  for (const item of parsed) {
    if (!isValidTaskInput(item)) {
      throw new Error('Each task must have a title (string) and description (string)')
    }
    validated.push(item)
  }

  return validated
}

function buildProjects(projectPaths: string | undefined): AITaskProject[] {
  if (!projectPaths) return []
  return projectPaths
    .split(',')
    .map(p => p.trim())
    .filter(Boolean)
    .map(projectPath => ({
      path: projectPath,
      label: projectPath.split('/').pop() || projectPath,
      gitStrategy: GIT_STRATEGY.WORKTREE,
    }))
}

function createTimeoutTimer(requestId: string): NodeJS.Timeout {
  return setTimeout(() => {
    const pending = pendingRequests.get(requestId)
    if (!pending) return
    pendingRequests.delete(requestId)
    if (mainWindow && !mainWindow.isDestroyed()) {
      ipcWebContentsSend('aiCloseTaskCreationStepper', mainWindow.webContents, { requestId })
    }
    pending.resolve({ timedOut: true })
  }, STEPPER_TIMEOUT_MS)
}

function waitForStepperResponse(requestId: string): Promise<TaskStepperResponse> {
  return new Promise((resolve) => {
    const timer = createTimeoutTimer(requestId)
    pendingRequests.set(requestId, { resolve, timer })
  })
}

function createTasksDirectly(taskInputs: TaskInput[], boardId: string | undefined): McpToolResult {
  const created: CreatedTaskResult[] = []
  const failed: FailedTaskResult[] = []

  for (const input of taskInputs) {
    const projects = buildProjects(input.projectPaths)
    try {
      const task = createTask(input.title, input.description, projects, boardId)
      created.push({ id: task.id, title: task.title })
    } catch (err) {
      failed.push({
        title: input.title,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  const createdLines = created.map(t => `- ${t.title} (${t.id})`).join('\n')
  let result = `Created ${created.length}/${taskInputs.length} tasks:\n${createdLines}`

  if (failed.length > 0) {
    const failedLines = failed.map(t => `- ${t.title}: ${t.error}`).join('\n')
    result += `\n\nFailed (${failed.length}):\n${failedLines}`
  }

  return textResult(result)
}

function createTasksFromApproved(tasks: TaskStepperApprovedTask[], boardId: string | undefined): McpToolResult {
  const created: CreatedTaskResult[] = []
  const failed: FailedTaskResult[] = []

  for (const approvedTask of tasks) {
    try {
      const task = createTask(approvedTask.title, approvedTask.description, approvedTask.projects, boardId)
      created.push({ id: task.id, title: task.title })
    } catch (err) {
      failed.push({
        title: approvedTask.title,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  const createdLines = created.map(t => `- ${t.title} (${t.id})`).join('\n')
  let result = `Created ${created.length}/${tasks.length} tasks (user-approved):\n${createdLines}`

  if (failed.length > 0) {
    const failedLines = failed.map(t => `- ${t.title}: ${t.error}`).join('\n')
    result += `\n\nFailed (${failed.length}):\n${failedLines}`
  }

  return textResult(result)
}

export function setTaskStepperMainWindow(window: BrowserWindow): void {
  mainWindow = window
}

export function resolveTaskCreationStepper(requestId: string, result: TaskStepperResponse): void {
  const pending = pendingRequests.get(requestId)
  if (!pending) return
  clearTimeout(pending.timer)
  pendingRequests.delete(requestId)
  pending.resolve(result)
}

export function resetTaskStepperTimeout(requestId: string): void {
  const pending = pendingRequests.get(requestId)
  if (!pending) return
  clearTimeout(pending.timer)
  pending.timer = createTimeoutTimer(requestId)
}

export function closeAllPendingSteppers(): void {
  for (const [requestId, pending] of pendingRequests) {
    clearTimeout(pending.timer)
    pending.resolve({ timedOut: true })
    if (mainWindow && !mainWindow.isDestroyed()) {
      ipcWebContentsSend('aiCloseTaskCreationStepper', mainWindow.webContents, { requestId })
    }
  }
  pendingRequests.clear()
}

export const createTasksTool: McpToolDefinition<{ tasks: string; boardId?: string }> = {
  name: 'create_tasks',
  description: 'Create multiple tasks at once. Pass a JSON array of tasks. Each task needs title, description, and optionally projectPaths. Much faster than calling create_task multiple times.',
  inputSchema: {
    type: 'object',
    properties: {
      tasks: { type: 'string', description: 'JSON array of tasks. Each element: { "title": "...", "description": "...", "projectPaths": "/path/to/project" }. projectPaths is comma-separated if multiple.' },
      boardId: { type: 'string', description: 'Board ID for all tasks. If omitted, uses the active board.' },
    },
    required: ['tasks'],
  },
  async handler(args): Promise<McpToolResult> {
    const { tasks: tasksJson, boardId } = args

    if (!tasksJson) {
      return errorResult('tasks parameter is required')
    }

    let taskInputs: TaskInput[]
    try {
      taskInputs = parseTasksJson(tasksJson)
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : 'Failed to parse tasks')
    }

    if (taskInputs.length === 0) {
      return errorResult('tasks array is empty')
    }

    if (!mainWindow || mainWindow.isDestroyed()) {
      return createTasksDirectly(taskInputs, boardId)
    }

    const requestId = randomUUID()
    const stepperRequest: TaskStepperRequest = {
      requestId,
      boardId: boardId || '',
      tasks: taskInputs.map(t => ({
        title: t.title,
        description: t.description,
        projectPaths: t.projectPaths,
      })),
    }

    ipcWebContentsSend('aiShowTaskCreationStepper', mainWindow.webContents, stepperRequest)

    const response = await waitForStepperResponse(requestId)

    if (response.cancelled) {
      return textResult('Task creation was cancelled by the user.')
    }

    if (response.timedOut) {
      return textResult("Task creation timed out. The user didn't complete the review in time.")
    }

    if (!response.tasks || response.tasks.length === 0) {
      return textResult('No tasks were approved by the user.')
    }

    return createTasksFromApproved(response.tasks, boardId)
  },
}
