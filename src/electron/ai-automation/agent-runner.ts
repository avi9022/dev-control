import { type ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import treeKill from 'tree-kill'
import { app, BrowserWindow } from 'electron'
import { ipcWebContentsSend } from '../utils/ipc-handle.js'
import { getTaskById, updateTask, moveTaskPhase, getSettings, getBoardPipeline } from './task-manager.js'
import { type ClaudeStreamEvent } from './stream-types.js'
import {
  FIXED_PHASES,
  PhaseExitEvent,
  PhaseType,
} from '../../shared/constants.js'
import { initLifecycle, spawnAgent, resumeAgent } from './agent-lifecycle.js'

const runningProcesses = new Map<string, ChildProcess>()
const agentStats = new Map<string, AIAgentStats>()
const pendingUserMessages = new Map<string, string>()
const taskQueue: string[] = []
let mainWindow: BrowserWindow | null = null
let aiLogsDir: string | null = null

function getAILogsDir(): string {
  if (!aiLogsDir) {
    aiLogsDir = path.join(app.getPath('userData'), 'ai-logs')
    if (!fs.existsSync(aiLogsDir)) {
      fs.mkdirSync(aiLogsDir, { recursive: true })
    }
  }
  return aiLogsDir
}

function getTaskLogPath(taskId: string): string {
  return path.join(getAILogsDir(), `${taskId}.log`)
}

function appendTaskLog(taskId: string, text: string): void {
  fs.appendFileSync(getTaskLogPath(taskId), text)
}

function emit(taskId: string, text: string): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    ipcWebContentsSend('aiTaskOutput', mainWindow.webContents, { taskId, output: text })
  }
}

function emitStreamEvent(taskId: string, event: ClaudeStreamEvent): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    ipcWebContentsSend('aiTaskStreamEvent', mainWindow.webContents, { taskId, event })
  }
}

function emitStats(taskId: string): void {
  const stats = agentStats.get(taskId)
  if (stats && mainWindow && !mainWindow.isDestroyed()) {
    ipcWebContentsSend('aiAgentStats', mainWindow.webContents, stats)
  }
}

function killProcess(taskId: string): void {
  const proc = runningProcesses.get(taskId)
  if (proc && proc.pid) {
    try { treeKill(proc.pid, 'SIGKILL') } catch { }
  }
}

initLifecycle({
  runningProcesses,
  pendingUserMessages,
  agentStats,
  emit,
  emitStreamEvent,
  emitStats,
  appendLog: appendTaskLog,
  enqueueTask,
  killProcess,
})

export function setAgentMainWindow(window: BrowserWindow): void {
  mainWindow = window
}

export function getAgentStats(taskId: string): AIAgentStats | null {
  return agentStats.get(taskId) || null
}

export function getTaskOutputHistory(taskId: string): string[] {
  const logPath = getTaskLogPath(taskId)
  if (!fs.existsSync(logPath)) return []
  const content = fs.readFileSync(logPath, 'utf-8')
  return content ? [content] : []
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
    const task = getTaskById(taskId)
    if (task) {
      const history = [...task.phaseHistory]
      if (history.length > 0) {
        history[history.length - 1] = {
          ...history[history.length - 1],
          exitedAt: new Date().toISOString(),
          exitEvent: PhaseExitEvent.Stopped,
        }
      }
      updateTask(taskId, { phaseHistory: history })
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

export function sendInput(taskId: string, input: string): void {
  const proc = runningProcesses.get(taskId)
  if (proc && proc.stdin && !proc.stdin.destroyed) {
    proc.stdin.write(input)
  }
}

export function interruptAgent(taskId: string, message: string): void {
  const proc = runningProcesses.get(taskId)

  if (!proc || proc.pid === undefined) {
    const task = getTaskById(taskId)
    if (task?.sessionId) {
      resumeAgent(taskId, message)
    }
    return
  }

  pendingUserMessages.set(taskId, message)
  treeKill(proc.pid, 'SIGTERM', (err) => {
    if (err) {
      treeKill(proc.pid!, 'SIGKILL', () => {})
    }
  })
}

export function enqueueTask(taskId: string): void {
  if (!taskQueue.includes(taskId)) {
    taskQueue.push(taskId)
  }
  processQueue()
}

function processQueue(): void {
  const settings = getSettings()

  while (taskQueue.length > 0 && runningProcesses.size < settings.maxConcurrency) {
    const taskId = taskQueue.shift()
    if (!taskId) break

    let task = getTaskById(taskId)
    if (!task) continue

    const pipeline = getBoardPipeline(task.boardId)

    if (task.phase === FIXED_PHASES.BACKLOG && pipeline.length > 0) {
      moveTaskPhase(taskId, pipeline[0].id)
      task = getTaskById(taskId)
      if (!task) continue
    }

    const phaseConfig = pipeline.find(p => p.id === task.phase)
    if (!phaseConfig || phaseConfig.type !== PhaseType.Agent) continue

    spawnAgent(taskId, phaseConfig)
  }
}
