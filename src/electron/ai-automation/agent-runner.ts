import { spawn, type ChildProcess } from 'child_process'
import treeKill from 'tree-kill'
import { BrowserWindow } from 'electron'
import { ipcWebContentsSend } from '../utils/ipc-handle.js'
import { getTaskById, updateTask, moveTaskPhase, getSettings } from './task-manager.js'
import { buildPrompt } from './prompt-builder.js'

const runningProcesses = new Map<string, ChildProcess>()
const taskQueue: string[] = []
let mainWindow: BrowserWindow | null = null

export function setAgentMainWindow(window: BrowserWindow) {
  mainWindow = window
}

export function stopAllAgents(): Promise<void[]> {
  const promises: Promise<void>[] = []
  for (const [taskId] of runningProcesses) {
    promises.push(stopAgent(taskId))
  }
  return Promise.all(promises)
}

export function stopAgent(taskId: string): Promise<void> {
  return new Promise((resolve) => {
    const proc = runningProcesses.get(taskId)
    if (!proc || proc.pid === undefined) {
      runningProcesses.delete(taskId)
      resolve()
      return
    }
    treeKill(proc.pid, 'SIGTERM', (err) => {
      if (err) {
        treeKill(proc.pid!, 'SIGKILL', () => {
          runningProcesses.delete(taskId)
          resolve()
        })
      } else {
        runningProcesses.delete(taskId)
        resolve()
      }
    })
  })
}

export function sendInput(taskId: string, input: string) {
  const proc = runningProcesses.get(taskId)
  if (proc && proc.stdin && !proc.stdin.destroyed) {
    proc.stdin.write(input)
  }
}

export function enqueueTask(taskId: string) {
  if (!taskQueue.includes(taskId)) {
    taskQueue.push(taskId)
  }
  processQueue()
}

function processQueue() {
  const settings = getSettings()

  while (taskQueue.length > 0 && runningProcesses.size < settings.maxConcurrency) {
    const taskId = taskQueue.shift()
    if (!taskId) break

    const task = getTaskById(taskId)
    if (!task) continue

    let role: AIAgentRole | null = null
    if (task.phase === 'TODO') {
      moveTaskPhase(taskId, 'PLANNING')
      role = 'planner'
    } else if (task.phase === 'PLANNING') {
      role = 'planner'
    } else if (task.phase === 'IN_PROGRESS') {
      role = 'worker'
    } else if (task.phase === 'AGENT_REVIEW') {
      role = 'reviewer'
    }

    if (role) {
      spawnAgent(taskId, role)
    }
  }
}

function spawnAgent(taskId: string, role: AIAgentRole) {
  const task = getTaskById(taskId)
  if (!task) return

  const systemPrompt = buildPrompt(task, role)

  let message = task.description
  if (role === 'worker' && task.plan) {
    message = `Implement the following task according to the plan.\n\nTask: ${task.description}\n\nPlan:\n${task.plan}`
  } else if (role === 'reviewer') {
    message = `Review the code changes for this task.\n\nTask: ${task.description}`
  }

  const args = [
    '--print',
    '--system-prompt', systemPrompt,
    message
  ]

  const cwd = task.worktreePath || process.cwd()

  const child = spawn('claude', args, {
    cwd,
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe']
  })

  runningProcesses.set(taskId, child)
  updateTask(taskId, { activeProcessPid: child.pid, currentAgentRole: role })

  let fullOutput = ''

  const sendOutput = (data: Buffer) => {
    const text = data.toString()
    fullOutput += text
    if (mainWindow && !mainWindow.isDestroyed()) {
      ipcWebContentsSend('aiTaskOutput', mainWindow.webContents, { taskId, output: text })
    }
  }

  child.stdout?.on('data', sendOutput)
  child.stderr?.on('data', sendOutput)

  child.on('exit', (code) => {
    runningProcesses.delete(taskId)
    updateTask(taskId, { activeProcessPid: undefined, currentAgentRole: undefined })
    handleAgentCompletion(taskId, role, fullOutput, code)
    processQueue()
  })

  child.on('error', (err) => {
    console.error(`Failed to spawn claude for task ${taskId}:`, err)
    runningProcesses.delete(taskId)
    updateTask(taskId, { activeProcessPid: undefined, currentAgentRole: undefined, needsUserInput: true })
  })
}

function handleAgentCompletion(taskId: string, role: AIAgentRole, output: string, exitCode: number | null) {
  const task = getTaskById(taskId)
  if (!task) return

  if (exitCode !== 0 && exitCode !== null) {
    updateTask(taskId, { needsUserInput: true })
    return
  }

  if (role === 'planner') {
    updateTask(taskId, { plan: output })
    moveTaskPhase(taskId, 'IN_PROGRESS')
    enqueueTask(taskId)
  } else if (role === 'worker') {
    moveTaskPhase(taskId, 'AGENT_REVIEW')
    enqueueTask(taskId)
  } else if (role === 'reviewer') {
    const approved = output.includes('REVIEW_DECISION: APPROVE')

    if (approved || task.reviewCycleCount >= task.maxReviewCycles) {
      moveTaskPhase(taskId, 'HUMAN_REVIEW')
    } else {
      const reviewComments: AIReviewComment[] = [{
        file: 'review',
        comment: output,
        severity: 'suggestion'
      }]
      updateTask(taskId, {
        reviewComments,
        reviewCycleCount: task.reviewCycleCount + 1
      })
      moveTaskPhase(taskId, 'IN_PROGRESS')
      enqueueTask(taskId)
    }
  }
}
