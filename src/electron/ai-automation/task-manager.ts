import { store } from '../storage/store.js'
import { randomUUID } from 'crypto'
import { BrowserWindow } from 'electron'
import { ipcWebContentsSend } from '../utils/ipc-handle.js'

const VALID_TRANSITIONS: Record<AITaskPhase, AITaskPhase[]> = {
  'BACKLOG': ['TODO'],
  'TODO': ['BACKLOG', 'PLANNING'],
  'PLANNING': ['IN_PROGRESS', 'TODO'],
  'IN_PROGRESS': ['AGENT_REVIEW', 'TODO'],
  'AGENT_REVIEW': ['IN_PROGRESS', 'HUMAN_REVIEW'],
  'HUMAN_REVIEW': ['DONE', 'IN_PROGRESS'],
  'DONE': []
}

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
  maxReviewCycles: number
): AITask {
  const now = new Date().toISOString()
  const task: AITask = {
    id: randomUUID(),
    title,
    description,
    phase: 'BACKLOG',
    createdAt: now,
    updatedAt: now,
    gitStrategy,
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
  const tasks = store.get('aiTasks').filter(t => t.id !== id)
  store.set('aiTasks', tasks)
  broadcastTasks()
}

export function moveTaskPhase(id: string, targetPhase: AITaskPhase): AITask {
  const tasks = store.get('aiTasks')
  const index = tasks.findIndex(t => t.id === id)
  if (index === -1) throw new Error(`Task ${id} not found`)

  const task = tasks[index]
  const allowed = VALID_TRANSITIONS[task.phase]
  if (!allowed.includes(targetPhase)) {
    throw new Error(`Cannot transition from ${task.phase} to ${targetPhase}`)
  }

  const now = new Date().toISOString()
  const history = [...task.phaseHistory]
  if (history.length > 0) {
    history[history.length - 1] = { ...history[history.length - 1], exitedAt: now }
  }
  history.push({ phase: targetPhase, enteredAt: now })

  tasks[index] = {
    ...task,
    phase: targetPhase,
    updatedAt: now,
    phaseHistory: history,
    needsUserInput: false
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
