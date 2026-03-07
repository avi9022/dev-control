import { store, DEFAULT_PIPELINE } from '../storage/store.js'
import { randomUUID } from 'crypto'
import { BrowserWindow } from 'electron'
import { ipcWebContentsSend } from '../utils/ipc-handle.js'
import { cleanupWorktree } from './worktree-manager.js'
import { getOrCreateTaskDir, cleanupTaskDir } from './task-dir-manager.js'

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
  gitStrategy: AIGitStrategy,
  maxReviewCycles: number,
  projectPaths?: string[],
  baseBranch?: string,
  customBranchName?: string,
  worktreeDir?: string
): AITask {
  const now = new Date().toISOString()
  const id = randomUUID()
  const taskDir = getOrCreateTaskDir(id)
  const task: AITask = {
    id,
    title,
    description,
    phase: 'BACKLOG',
    createdAt: now,
    updatedAt: now,
    gitStrategy,
    baseBranch: baseBranch || undefined,
    customBranchName: customBranchName || undefined,
    worktreeDir: worktreeDir || undefined,
    projectPaths: projectPaths?.length ? projectPaths : undefined,
    taskDirPath: taskDir,
    maxReviewCycles,
    reviewCycleCount: 0,
    needsUserInput: false,
    phaseHistory: [{ phase: 'BACKLOG', enteredAt: now }]
  }

  const tasks = store.get('aiTasks')
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
  store.set('aiTasks', tasks)
  broadcastTasks()
}

export function deleteTask(id: string) {
  const task = store.get('aiTasks').find(t => t.id === id)
  // Cleanup worktree if it exists
  if (task?.worktreePath && task.projectPaths?.[0]) {
    try {
      cleanupWorktree(task.projectPaths[0], task.worktreePath)
    } catch {
      // Best effort cleanup
    }
  }
  // Cleanup task directory
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
  // First pipeline phase can go back to BACKLOG
  if (to === 'BACKLOG' && fromIndex === 1) return true
  // Forward by one step
  if (toIndex === fromIndex + 1) return true
  // Reject routing: any pipeline phase can go to any other pipeline phase
  if (from !== 'BACKLOG' && from !== 'DONE' && to !== 'BACKLOG' && to !== 'DONE') return true
  // Moving to DONE from any phase
  if (to === 'DONE' && from !== 'BACKLOG') return true

  return false
}

export function moveTaskPhase(id: string, targetPhase: string): AITask {
  const tasks = store.get('aiTasks')
  const index = tasks.findIndex(t => t.id === id)
  if (index === -1) throw new Error(`Task ${id} not found`)

  const task = tasks[index]
  const settings = getSettings()
  const pipeline = settings.pipeline || []

  if (!isValidTransition(task.phase, targetPhase, pipeline)) {
    throw new Error(`Cannot transition from ${task.phase} to ${targetPhase}`)
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
    currentPhaseName
  }
  store.set('aiTasks', tasks)
  broadcastTasks()
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

export function migrateSettings() {
  const settings = store.get('aiAutomationSettings')

  // If pipeline already exists, skip
  if (settings.pipeline && settings.pipeline.length > 0) return

  // Initialize default pipeline
  const pipeline = DEFAULT_PIPELINE.map(p => ({ ...p }))

  // Copy existing phase prompts into pipeline
  if (settings.phasePrompts) {
    if (settings.phasePrompts.planning) {
      const planningPhase = pipeline.find(p => p.id === 'planning')
      if (planningPhase) planningPhase.prompt = settings.phasePrompts.planning
    }
    if (settings.phasePrompts.working) {
      const workingPhase = pipeline.find(p => p.id === 'in-progress')
      if (workingPhase) workingPhase.prompt = settings.phasePrompts.working
    }
    if (settings.phasePrompts.reviewing) {
      const reviewPhase = pipeline.find(p => p.id === 'agent-review')
      if (reviewPhase) reviewPhase.prompt = settings.phasePrompts.reviewing
    }
  }

  store.set('aiAutomationSettings', { ...settings, pipeline })
}

export function migrateExistingTasks() {
  const settings = getSettings()
  if (!settings.pipeline || settings.pipeline.length === 0) return

  const tasks = store.get('aiTasks')
  let changed = false

  const PHASE_MAP: Record<string, string> = {
    'TODO': settings.pipeline[0]?.id || 'BACKLOG',
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
