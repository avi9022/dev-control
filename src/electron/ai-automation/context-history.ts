import fs from 'fs'
import path from 'path'
import { type ClaudeStreamEvent } from './stream-types.js'
import { updateTask } from './task-manager.js'

export interface EventRecorder {
  append: (event: ClaudeStreamEvent) => void
  finalize: () => void
}

export function createEventRecorder(contextHistoryDir: string): EventRecorder {
  let eventCount = 0
  const eventsPath = path.join(contextHistoryDir, 'events.json')

  try {
    const existing = fs.readFileSync(eventsPath, 'utf-8')
    if (existing.trimEnd().endsWith(']')) {
      const reopened = existing.trimEnd().slice(0, -1)
      fs.writeFileSync(eventsPath, reopened)
      const trimmed = reopened.trim()
      if (trimmed.length > 1) {
        eventCount = 1
      }
    }
  } catch { }

  return {
    append(event: ClaudeStreamEvent): void {
      try {
        const prefix = eventCount > 0 ? ',\n' : ''
        fs.appendFileSync(eventsPath, prefix + JSON.stringify(event))
        eventCount++
      } catch { }
    },
    finalize(): void {
      try {
        fs.appendFileSync(eventsPath, '\n]')
      } catch { }
    },
  }
}

export function ensureContextHistoryDir(task: AITask, taskId: string, phaseConfig: AIPipelinePhase): string | undefined {
  const taskDirPath = task.taskDirPath
  if (!taskDirPath) return undefined

  const lastEntry = task.phaseHistory.length > 0
    ? task.phaseHistory[task.phaseHistory.length - 1]
    : undefined

  if (lastEntry?.contextHistoryPath) return lastEntry.contextHistoryPath

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const contextHistoryDir = path.join(taskDirPath, 'context-history', `${phaseConfig.id}-${timestamp}`)
  fs.mkdirSync(contextHistoryDir, { recursive: true })
  fs.writeFileSync(path.join(contextHistoryDir, 'events.json'), '[\n')

  if (lastEntry && lastEntry.phase === phaseConfig.id && !lastEntry.exitedAt) {
    const phaseHistory = [...task.phaseHistory]
    phaseHistory[phaseHistory.length - 1] = { ...lastEntry, contextHistoryPath: contextHistoryDir, sessionId: task.sessionId }
    updateTask(taskId, { phaseHistory })
  }

  return contextHistoryDir
}
