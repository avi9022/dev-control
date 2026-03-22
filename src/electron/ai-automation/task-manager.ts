import { store, DEFAULT_PIPELINE } from '../storage/store.js'
import { randomUUID } from 'crypto'
import { BrowserWindow } from 'electron'
import { ipcWebContentsSend } from '../utils/ipc-handle.js'
import { cleanupWorktree } from './worktree-manager.js'
import { getOrCreateTaskDir, cleanupTaskDir, migrateTaskDirStructure } from './task-dir-manager.js'
import { sendNotification } from './notification-manager.js'
import { extractLinkedTaskIds } from './cross-reference-parser.js'

let mainWindow: BrowserWindow | null = null

export function setTaskManagerMainWindow(window: BrowserWindow) {
  mainWindow = window
}

function broadcastTasks() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const tasks = store.get('aiTasks')
    ipcWebContentsSend('aiTasks', mainWindow.webContents, tasks)
  }
}

export function getTasks(): AITask[] {
  return store.get('aiTasks')
}

export function getTaskById(id: string): AITask | undefined {
  return store.get('aiTasks').find(t => t.id === id)
}

export function createTask(
  title: string,
  description: string,
  projects: AITaskProject[],
  boardId?: string
): AITask {
  const now = new Date().toISOString()
  const id = randomUUID()
  const taskDir = getOrCreateTaskDir(id)
  const settings = getSettings()
  const resolvedBoardId = boardId || settings.activeBoardId || 'default'
  const task: AITask = {
    id,
    title,
    description,
    boardId: resolvedBoardId,
    phase: 'BACKLOG',
    createdAt: now,
    updatedAt: now,
    projects,
    taskDirPath: taskDir,
    worktrees: [],
    needsUserInput: false,
    phaseHistory: [{ phase: 'BACKLOG', enteredAt: now }]
  }

  const tasks = store.get('aiTasks')
  task.linkedTaskIds = extractLinkedTaskIds(task, tasks)
  tasks.push(task)
  store.set('aiTasks', tasks)
  broadcastTasks()
  return task
}

export function updateTask(id: string, updates: Partial<AITask>) {
  const tasks = store.get('aiTasks')
  const index = tasks.findIndex(t => t.id === id)
  if (index === -1) throw new Error(`Task ${id} not found`)

  tasks[index] = { ...tasks[index], ...updates, updatedAt: new Date().toISOString() }
  // Re-parse linked task IDs when description or amendments change
  if (updates.description !== undefined || updates.amendments !== undefined) {
    tasks[index].linkedTaskIds = extractLinkedTaskIds(tasks[index], tasks)
  }
  store.set('aiTasks', tasks)
  broadcastTasks()
}

export function deleteTask(id: string) {
  const task = store.get('aiTasks').find(t => t.id === id)
  // Cleanup worktrees
  if (task?.worktrees) {
    for (const wt of task.worktrees) {
      try {
        cleanupWorktree(wt.projectPath, wt.worktreePath)
      } catch {
        // Best effort cleanup
      }
    }
  }
  // Legacy: cleanup single worktree if still present from pre-migration
  const taskRecord = task as unknown as Record<string, unknown>
  if (taskRecord?.worktreePath && task?.projectPaths?.[0]) {
    try {
      cleanupWorktree(task.projectPaths[0], taskRecord.worktreePath as string)
    } catch {
      // Best effort cleanup
    }
  }
  cleanupTaskDir(id)
  const tasks = store.get('aiTasks').filter(t => t.id !== id)
  store.set('aiTasks', tasks)
  broadcastTasks()
}

function isValidTransition(from: string, to: string, pipeline: AIPipelinePhase[]): boolean {
  const phaseIds = pipeline.map(p => p.id)
  const allPhases = ['BACKLOG', ...phaseIds, 'DONE']
  const fromIndex = allPhases.indexOf(from)
  const toIndex = allPhases.indexOf(to)

  // BACKLOG can go to first pipeline phase
  if (from === 'BACKLOG' && toIndex === 1) return true
  // Any pipeline phase can go back to BACKLOG
  if (to === 'BACKLOG' && from !== 'DONE') return true
  // Forward by one step
  if (toIndex === fromIndex + 1) return true
  // Reject routing: any pipeline phase can go to any other pipeline phase
  if (from !== 'BACKLOG' && from !== 'DONE' && to !== 'BACKLOG' && to !== 'DONE') return true
  // Moving to DONE from any phase
  if (to === 'DONE' && from !== 'BACKLOG') return true
  // Amendment routing: DONE can go back to any pipeline phase
  if (from === 'DONE' && to !== 'BACKLOG' && to !== 'DONE') return true

  return false
}

export function moveTaskPhase(id: string, targetPhase: string): AITask {
  const tasks = store.get('aiTasks')
  const index = tasks.findIndex(t => t.id === id)
  if (index === -1) throw new Error(`Task ${id} not found`)

  const task = tasks[index]
  const pipeline = getBoardPipeline(task.boardId)

  // BACKLOG can go to any pipeline phase (user drag), and any phase can go to BACKLOG
  if (!isValidTransition(task.phase, targetPhase, pipeline)) {
    console.warn(`[task-manager] Invalid transition from ${task.phase} to ${targetPhase} — allowing anyway`)
  }

  const now = new Date().toISOString()
  const history = [...task.phaseHistory]
  if (history.length > 0) {
    history[history.length - 1] = { ...history[history.length - 1], exitedAt: now }
  }
  history.push({ phase: targetPhase, enteredAt: now })

  // Look up display name for the phase
  const phaseConfig = pipeline.find(p => p.id === targetPhase)
  const currentPhaseName = phaseConfig?.name || targetPhase

  tasks[index] = {
    ...task,
    phase: targetPhase,
    updatedAt: now,
    phaseHistory: history,
    needsUserInput: false,
    needsUserInputReason: undefined,
    stallRetryCount: 0,
    currentPhaseName
  }
  store.set('aiTasks', tasks)
  broadcastTasks()

  // Notify on phase transitions
  const targetPhaseConfig = pipeline.find(p => p.id === targetPhase)
  if (targetPhase === 'DONE') {
    sendNotification('task_done', id, task.title, 'Task completed')
  } else if (targetPhaseConfig?.type === 'manual') {
    sendNotification('manual_phase', id, task.title, `Ready for ${targetPhaseConfig.name}`)
  }

  return tasks[index]
}

export function getSettings(): AIAutomationSettings {
  return store.get('aiAutomationSettings')
}

export function updateSettings(updates: Partial<AIAutomationSettings>) {
  const current = store.get('aiAutomationSettings')
  store.set('aiAutomationSettings', { ...current, ...updates })
}

// --- Migration ---

export function migrateTaskWorkspaces() {
  const tasks = store.get('aiTasks')
  const settings = store.get('aiAutomationSettings') as unknown as Record<string, unknown>
  let changed = false

  for (const task of tasks) {
    // Migrate directory structure (move loose files to agent/)
    migrateTaskDirStructure(task.id)

    // Convert worktreePath to worktrees array
    const taskRec = task as unknown as Record<string, unknown>
    if (taskRec.worktreePath && !task.worktrees) {
      const worktreePath = taskRec.worktreePath as string
      const projectPath = task.projectPaths?.[0] || ''
      const branchName = task.branchName || ''
      task.worktrees = [{ projectPath, worktreePath, branchName }]
      delete taskRec.worktreePath
      delete taskRec.worktreeDir
      changed = true
    }

    // Ensure worktrees array exists
    if (!task.worktrees) {
      task.worktrees = []
      changed = true
    }

    // Remove deprecated fields
    const taskDeprecated = task as unknown as Record<string, unknown>
    if ('maxReviewCycles' in task || 'reviewCycleCount' in task) {
      delete taskDeprecated.maxReviewCycles
      delete taskDeprecated.reviewCycleCount
      changed = true
    }

    // Migrate projectPaths to projects array
    if (!task.projects && task.projectPaths) {
      const paths = task.projectPaths || []
      const taskLegacy = task as unknown as Record<string, unknown>
      task.projects = paths.map((p, i) => ({
        path: p,
        label: p.split('/').pop() || p,
        gitStrategy: (taskLegacy.gitStrategy as string) || 'worktree',
        ...(i === 0 ? {
          baseBranch: (taskLegacy.baseBranch as string) || undefined,
          customBranchName: (taskLegacy.customBranchName as string) || undefined,
        } : {})
      }))
      changed = true
    }

    // Ensure projects array exists
    if (!task.projects) {
      task.projects = []
      changed = true
    }
  }

  // Remove deprecated settings fields
  if ('defaultMaxReviewCycles' in settings || 'defaultWorktreeDir' in settings) {
    delete settings.defaultMaxReviewCycles
    delete settings.defaultWorktreeDir
    store.set('aiAutomationSettings', settings as unknown as AIAutomationSettings)
  }

  if (changed) {
    store.set('aiTasks', tasks)
  }
}

export function migrateSettings() {
  const settings = store.get('aiAutomationSettings') as unknown as Record<string, unknown>

  // If pipeline already exists (pre-boards migration), skip
  if (settings.pipeline && (settings.pipeline as unknown as unknown[]).length > 0) return

  // Initialize default pipeline
  const pipeline = DEFAULT_PIPELINE.map(p => ({ ...p }))

  // Copy existing phase prompts into pipeline
  const phasePrompts = settings.phasePrompts as AIAutomationSettings['phasePrompts'] | undefined
  if (phasePrompts) {
    if (phasePrompts.planning) {
      const planningPhase = pipeline.find(p => p.id === 'planning')
      if (planningPhase) planningPhase.prompt = phasePrompts.planning
    }
    if (phasePrompts.working) {
      const workingPhase = pipeline.find(p => p.id === 'in-progress')
      if (workingPhase) workingPhase.prompt = phasePrompts.working
    }
    if (phasePrompts.reviewing) {
      const reviewPhase = pipeline.find(p => p.id === 'agent-review')
      if (reviewPhase) reviewPhase.prompt = phasePrompts.reviewing
    }
  }

  store.set('aiAutomationSettings', { ...settings, pipeline } as unknown as AIAutomationSettings)
}

export function migrateExistingTasks() {
  const settings = getSettings() as unknown as Record<string, unknown>
  const legacyPipeline = settings.pipeline as AIPipelinePhase[] | undefined
  if (!legacyPipeline || legacyPipeline.length === 0) return

  const tasks = store.get('aiTasks')
  let changed = false

  const PHASE_MAP: Record<string, string> = {
    'TODO': legacyPipeline[0]?.id || 'BACKLOG',
    'PLANNING': 'planning',
    'IN_PROGRESS': 'in-progress',
    'AGENT_REVIEW': 'agent-review',
    'HUMAN_REVIEW': 'human-review',
  }

  for (const task of tasks) {
    if (task.phase in PHASE_MAP) {
      task.phase = PHASE_MAP[task.phase]
      changed = true
    }
    for (const entry of task.phaseHistory) {
      if (entry.phase in PHASE_MAP) {
        entry.phase = PHASE_MAP[entry.phase]
        changed = true
      }
    }
    // Ensure task directory exists
    if (!task.taskDirPath) {
      task.taskDirPath = getOrCreateTaskDir(task.id)
      changed = true
    }
  }

  if (changed) {
    store.set('aiTasks', tasks)
  }
}

export function migrateToBoards(): void {
  const settings = store.get('aiAutomationSettings')

  // Already migrated
  if (settings.boards && settings.boards.length > 0) return

  // Create default board from existing pipeline
  const settingsRecord = settings as unknown as Record<string, unknown>
  const existingPipeline = (settingsRecord.pipeline as AIPipelinePhase[]) || DEFAULT_PIPELINE
  const defaultBoard: AIBoard = {
    id: 'default',
    name: 'My Board',
    color: '#9BB89E',
    pipeline: existingPipeline,
    createdAt: new Date().toISOString(),
  }

  // Update settings
  const updated: Record<string, unknown> = { ...settings, boards: [defaultBoard], activeBoardId: 'default' }
  delete updated.pipeline
  store.set('aiAutomationSettings', updated as unknown as AIAutomationSettings)

  // Add boardId to all existing tasks
  const tasks = store.get('aiTasks')
  const migrated = tasks.map(t => t.boardId ? t : { ...t, boardId: 'default' })
  store.set('aiTasks', migrated)

  console.log('[task-manager] Migrated to boards: created default board, assigned boardId to tasks')
}

export function getActivePipeline(): AIPipelinePhase[] {
  const settings = getSettings()
  const board = settings.boards?.find(b => b.id === settings.activeBoardId)
  return board?.pipeline || []
}

export function getBoardPipeline(boardId: string): AIPipelinePhase[] {
  const settings = getSettings()
  const board = settings.boards?.find(b => b.id === boardId)
  return board?.pipeline || []
}

export function recoverStaleTasks(): void {
  const tasks = getTasks()
  let changed = false
  const updated = tasks.map(task => {
    if (!task.activeProcessPid) return task
    let alive = false
    try {
      process.kill(task.activeProcessPid, 0)
      alive = true
    } catch {
      // Process doesn't exist
    }
    if (!alive) {
      console.log(`[task-manager] Recovered stale task: ${task.id} (pid ${task.activeProcessPid} no longer running)`)
      changed = true
      const history = [...task.phaseHistory]
      if (history.length > 0) {
        history[history.length - 1] = {
          ...history[history.length - 1],
          exitedAt: new Date().toISOString(),
          exitEvent: 'crashed',
        }
      }
      return {
        ...task,
        activeProcessPid: undefined,
        currentPhaseName: undefined,
        needsUserInput: true,
        needsUserInputReason: 'crashed',
        phaseHistory: history,
        updatedAt: new Date().toISOString(),
      }
    }
    return task
  })
  if (changed) {
    store.set('aiTasks', updated)
    broadcastTasks()
  }
}
