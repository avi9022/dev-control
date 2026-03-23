import { randomUUID } from 'crypto'
import path from 'path'
import fs from 'fs'
import { execFile } from 'child_process'
import { BrowserWindow } from 'electron'
import { ipcWebContentsSend } from '../../utils/ipc-handle.js'
import { addDirectoryToStore } from '../../utils/add-directory-to-store.js'
import { store } from '../../storage/store.js'
import { getSettings, updateSettings } from '../task-manager.js'
import { DEFAULT_PIPELINE } from '../../storage/store.js'
import { type McpToolDefinition, textResult, errorResult } from './types.js'
import { DEFAULT_BOARD_COLOR } from '../../../shared/constants.js'

const PROJECT_CREATION_TIMEOUT_MS = 55_000
const INITIAL_COMMIT_MESSAGE = 'Initial commit'

interface PendingRequest {
  resolve: (result: ProjectCreationResponse) => void
  timer: NodeJS.Timeout
}

const pendingRequests = new Map<string, PendingRequest>()

let mainWindow: BrowserWindow | null = null

export function setProjectCreationMainWindow(window: BrowserWindow): void {
  mainWindow = window
}

export function resolveProjectCreation(requestId: string, result: ProjectCreationResponse): void {
  const pending = pendingRequests.get(requestId)
  if (!pending) return
  clearTimeout(pending.timer)
  pendingRequests.delete(requestId)
  pending.resolve(result)
}

export function closeAllPendingModals(): void {
  for (const [requestId, pending] of pendingRequests) {
    clearTimeout(pending.timer)
    pending.resolve({ timedOut: true })
    if (mainWindow && !mainWindow.isDestroyed()) {
      ipcWebContentsSend('aiCloseProjectCreationModal', mainWindow.webContents, { requestId })
    }
  }
  pendingRequests.clear()
}

function waitForUserResponse(requestId: string): Promise<ProjectCreationResponse> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId)
      if (mainWindow && !mainWindow.isDestroyed()) {
        ipcWebContentsSend('aiCloseProjectCreationModal', mainWindow.webContents, { requestId })
      }
      resolve({ timedOut: true })
    }, PROJECT_CREATION_TIMEOUT_MS)

    pendingRequests.set(requestId, { resolve, timer })
  })
}

function gitInit(projectPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('git', ['init'], { cwd: projectPath }, (err) => {
      if (err) {
        reject(err)
        return
      }
      execFile('git', ['commit', '--allow-empty', '-m', INITIAL_COMMIT_MESSAGE], { cwd: projectPath }, (commitErr) => {
        if (commitErr) {
          reject(commitErr)
          return
        }
        resolve()
      })
    })
  })
}

function createBoard(name: string): { id: string; name: string } {
  const settings = getSettings()
  const boards = settings.boards || []

  const newBoard = {
    id: randomUUID(),
    name,
    color: DEFAULT_BOARD_COLOR,
    pipeline: DEFAULT_PIPELINE.map(p => ({ ...p })),
    createdAt: new Date().toISOString(),
  }

  updateSettings({
    boards: [...boards, newBoard],
    activeBoardId: newBoard.id,
  })

  return { id: newBoard.id, name: newBoard.name }
}

function findBoardById(boardId: string): { id: string; name: string } | null {
  const settings = getSettings()
  const board = (settings.boards || []).find(b => b.id === boardId)
  if (!board) return null
  return { id: board.id, name: board.name }
}

export const requestProjectCreationTool: McpToolDefinition<{ suggestedName?: string }> = {
  name: 'request_project_creation',
  description: 'Request the user to create a new project via a UI modal. The user chooses location, project name, git init, and board assignment. Returns project details after creation.',
  inputSchema: {
    type: 'object',
    properties: {
      suggestedName: { type: 'string', description: 'Suggested project name to pre-fill in the form' },
    },
    required: [],
  },
  async handler(args) {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return errorResult('No active window to show project creation modal')
    }

    const suggestedName = args.suggestedName || ''
    const requestId = randomUUID()

    ipcWebContentsSend('aiShowProjectCreationModal', mainWindow.webContents, {
      suggestedName,
      requestId,
    })

    const response = await waitForUserResponse(requestId)

    if (response.cancelled) {
      return textResult('Project creation was cancelled by the user.')
    }

    if (response.timedOut) {
      return textResult("Project creation timed out. The user didn't complete the form in time.")
    }

    if (!response.formData) {
      return errorResult('No form data received from the project creation modal.')
    }

    const { formData } = response

    try {
      const projectPath = path.join(formData.location, formData.projectName)
      fs.mkdirSync(projectPath, { recursive: true })

      if (formData.gitInit) {
        await gitInit(projectPath)
      }

      await addDirectoryToStore(projectPath)

      const directories = store.get('directories')
      const dirEntry = directories.find(d => d.path === projectPath)
      if (dirEntry) {
        const updated = directories.map(d =>
          d.path === projectPath ? { ...d, customLabel: formData.projectName } : d
        )
        store.set('directories', updated)
      }

      const projectId = dirEntry ? dirEntry.id : Buffer.from(projectPath).toString('base64')

      let boardId: string
      let boardName: string

      if (formData.boardMode === 'new' && formData.newBoardName) {
        const board = createBoard(formData.newBoardName)
        boardId = board.id
        boardName = board.name
      } else if (formData.boardMode === 'existing' && formData.existingBoardId) {
        const board = findBoardById(formData.existingBoardId)
        if (!board) {
          return errorResult(`Board with ID ${formData.existingBoardId} not found.`)
        }
        boardId = board.id
        boardName = board.name
      } else {
        return errorResult('Invalid board configuration: must specify either a new board name or an existing board ID.')
      }

      const result: ProjectCreationToolResult = {
        projectPath,
        projectName: formData.projectName,
        projectId,
        boardId,
        boardName,
      }

      return textResult(
        `Project created successfully.\n` +
        `- Path: ${result.projectPath}\n` +
        `- Name: ${result.projectName}\n` +
        `- Project ID: ${result.projectId}\n` +
        `- Board: ${result.boardName} (${result.boardId})\n` +
        `- Git initialized: ${formData.gitInit ? 'yes' : 'no'}`
      )
    } catch (err) {
      return errorResult(`Failed to create project: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  },
}
