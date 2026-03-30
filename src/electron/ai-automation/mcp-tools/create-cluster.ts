import { randomUUID } from 'crypto'
import { type BrowserWindow } from 'electron'
import { createCluster, getSettings } from '../task-manager.js'
import { ipcWebContentsSend } from '../../utils/ipc-handle.js'
import { type McpToolDefinition, type McpToolResult, textResult, errorResult } from './types.js'
import { GIT_STRATEGY } from '../../../shared/constants.js'

interface SubtaskInput {
  title: string
  description: string
}

interface PendingClusterRequest {
  resolve: (result: ClusterCreationResponse) => void
}

let mainWindow: BrowserWindow | null = null
const pendingRequests = new Map<string, PendingClusterRequest>()

export function setClusterCreationMainWindow(window: BrowserWindow): void {
  mainWindow = window
}

export function resolveClusterCreation(requestId: string, result: ClusterCreationResponse): void {
  const pending = pendingRequests.get(requestId)
  if (!pending) return
  pendingRequests.delete(requestId)
  pending.resolve(result)
}

function waitForClusterResponse(requestId: string): Promise<ClusterCreationResponse> {
  return new Promise((resolve) => {
    pendingRequests.set(requestId, { resolve })
  })
}

function createClusterDirectly(title: string, subtasks: SubtaskInput[], projectPaths: string | undefined, boardId: string | undefined): McpToolResult {
  const defaultBaseBranch = getSettings().defaultBaseBranch || undefined
  const projects = projectPaths
    ? projectPaths.split(',').map(p => p.trim()).filter(Boolean).map(projectPath => ({
        path: projectPath,
        label: projectPath.split('/').pop() || projectPath,
        gitStrategy: GIT_STRATEGY.WORKTREE,
        baseBranch: defaultBaseBranch,
      }))
    : []

  try {
    const cluster = createCluster(title, subtasks, projects, boardId)
    const subtaskSummary = cluster.subtasks?.map((s, i) => `  ${i + 1}. ${s.title}`).join('\n') || ''
    return textResult(`Cluster created successfully.\nID: ${cluster.id}\nTitle: ${cluster.title}\nSubtasks (${cluster.subtasks?.length || 0}):\n${subtaskSummary}`)
  } catch (err) {
    return errorResult(`Failed to create cluster: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }
}

export const createClusterTool: McpToolDefinition = {
  name: 'create_cluster',
  description: 'Create a task cluster — a parent task with ordered subtasks that share a worktree. Use this when a feature needs to be broken into sequential steps. Each subtask runs the full pipeline independently and auto-advances on completion. Pass subtasks as a JSON string array.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Cluster title (the feature name)' },
      subtasks: { type: 'string', description: 'JSON array of subtasks, each with title and description. Example: [{"title":"Step 1","description":"Do X"},{"title":"Step 2","description":"Do Y"}]' },
      projectPaths: { type: 'string', description: 'Comma-separated project directory paths. All subtasks share the same worktree.' },
      boardId: { type: 'string', description: 'Board ID. If omitted, uses the active board.' },
    },
    required: ['title', 'subtasks'],
  },
  async handler(args): Promise<McpToolResult> {
    const title = args.title
    const subtasksRaw = args.subtasks
    const projectPaths = args.projectPaths
    const boardId = args.boardId

    if (!title) return errorResult('title is required')
    if (!subtasksRaw) return errorResult('subtasks is required')

    let subtasks: SubtaskInput[]
    try {
      subtasks = JSON.parse(subtasksRaw)
    } catch {
      return errorResult('subtasks must be a valid JSON array')
    }

    if (!Array.isArray(subtasks) || subtasks.length === 0) {
      return errorResult('at least one subtask is required')
    }

    if (!mainWindow || mainWindow.isDestroyed()) {
      return createClusterDirectly(title, subtasks, projectPaths, boardId)
    }

    const requestId = randomUUID()
    const request: ClusterCreationRequest = {
      requestId,
      title,
      subtasks,
      projectPaths,
      boardId,
    }

    ipcWebContentsSend('aiShowClusterCreationModal', mainWindow.webContents, request)

    const response = await waitForClusterResponse(requestId)

    if (response.cancelled) {
      return textResult('Cluster creation was cancelled by the user.')
    }

    try {
      const cluster = createCluster(response.title, response.subtasks, response.projects, boardId)
      const subtaskSummary = cluster.subtasks?.map((s, i) => `  ${i + 1}. ${s.title}`).join('\n') || ''
      return textResult(`Cluster created (user-approved).\nID: ${cluster.id}\nTitle: ${cluster.title}\nSubtasks (${cluster.subtasks?.length || 0}):\n${subtaskSummary}`)
    } catch (err) {
      return errorResult(`Failed to create cluster: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  },
}
