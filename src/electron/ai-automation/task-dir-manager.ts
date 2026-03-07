import path from 'path'
import fs from 'fs'
import { app } from 'electron'

const TASK_DATA_DIR = 'ai-task-data'

function getTaskDataBase(): string {
  const base = path.join(app.getPath('userData'), TASK_DATA_DIR)
  if (!fs.existsSync(base)) {
    fs.mkdirSync(base, { recursive: true })
  }
  return base
}

export function getOrCreateTaskDir(taskId: string): string {
  const taskDir = path.join(getTaskDataBase(), taskId)
  if (!fs.existsSync(taskDir)) {
    fs.mkdirSync(taskDir, { recursive: true })
  }
  return taskDir
}

export function cleanupTaskDir(taskId: string): void {
  const taskDir = path.join(getTaskDataBase(), taskId)
  try {
    if (fs.existsSync(taskDir)) {
      fs.rmSync(taskDir, { recursive: true, force: true })
    }
  } catch {
    // Best effort
  }
}

export function listTaskDirFiles(taskId: string): string[] {
  const taskDir = path.join(getTaskDataBase(), taskId)
  if (!fs.existsSync(taskDir)) return []
  return fs.readdirSync(taskDir).filter(f => {
    const stat = fs.statSync(path.join(taskDir, f))
    return stat.isFile()
  })
}

export function readTaskDirFile(taskId: string, filename: string): string {
  const filePath = path.join(getTaskDataBase(), taskId, filename)
  if (!fs.existsSync(filePath)) return ''
  return fs.readFileSync(filePath, 'utf-8')
}
