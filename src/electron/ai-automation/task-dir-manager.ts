import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { store } from '../storage/store.js'

function getTaskDataBase(): string {
  const settings = store.get('aiAutomationSettings')
  const base = settings.taskDataRoot || path.join(app.getPath('userData'), 'ai-task-data')
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

export function getAgentDir(taskId: string): string {
  const dir = path.join(getOrCreateTaskDir(taskId), 'agent')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function getAttachmentsDir(taskId: string): string {
  const dir = path.join(getOrCreateTaskDir(taskId), 'attachments')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function getWorktreesDir(taskId: string): string {
  const dir = path.join(getOrCreateTaskDir(taskId), 'worktrees')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
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
  const agentDir = path.join(getOrCreateTaskDir(taskId), 'agent')
  if (!fs.existsSync(agentDir)) return []
  return fs.readdirSync(agentDir).filter(f => {
    const stat = fs.statSync(path.join(agentDir, f))
    return stat.isFile()
  })
}

export function readTaskDirFile(taskId: string, filename: string): string {
  const filePath = path.join(getOrCreateTaskDir(taskId), 'agent', filename)
  if (!fs.existsSync(filePath)) return ''
  return fs.readFileSync(filePath, 'utf-8')
}

export function attachFiles(taskId: string, filePaths: string[]): string[] {
  const attachDir = getAttachmentsDir(taskId)
  const filenames: string[] = []
  for (const filePath of filePaths) {
    const filename = path.basename(filePath)
    const dest = path.join(attachDir, filename)
    fs.copyFileSync(filePath, dest)
    filenames.push(filename)
  }
  return filenames
}

export function deleteAttachment(taskId: string, filename: string): void {
  const filePath = path.join(getAttachmentsDir(taskId), filename)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
}

export function listAttachments(taskId: string): string[] {
  const attachDir = path.join(getOrCreateTaskDir(taskId), 'attachments')
  if (!fs.existsSync(attachDir)) return []
  return fs.readdirSync(attachDir).filter(f => {
    const stat = fs.statSync(path.join(attachDir, f))
    return stat.isFile()
  })
}

export function migrateTaskDirStructure(taskId: string): void {
  const taskDir = getOrCreateTaskDir(taskId)
  const agentDir = path.join(taskDir, 'agent')
  if (fs.existsSync(agentDir)) return
  fs.mkdirSync(agentDir, { recursive: true })
  const entries = fs.readdirSync(taskDir)
  for (const entry of entries) {
    const fullPath = path.join(taskDir, entry)
    const stat = fs.statSync(fullPath)
    if (stat.isFile()) {
      fs.renameSync(fullPath, path.join(agentDir, entry))
    }
  }
}
