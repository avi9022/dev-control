import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { type PlannerChatMessage, type PlannerDebugEvent } from '../planner-runner.js'

const PLANNER_DIR = 'planner-history'

interface PlannerConversationFile {
  sessionId: string
  messages: PlannerChatMessage[]
  debugEvents: PlannerDebugEvent[]
  updatedAt: string
  createdAt: string
}

function ensurePlannerDir(): string {
  const dir = path.join(app.getPath('userData'), PLANNER_DIR)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function readExistingConversation(filepath: string): PlannerConversationFile | null {
  try {
    const raw = fs.readFileSync(filepath, 'utf-8')
    return JSON.parse(raw) as PlannerConversationFile
  } catch {
    return null
  }
}

export function savePlannerConversation(
  sessionId: string,
  messages: PlannerChatMessage[],
  debugEvents: PlannerDebugEvent[],
): string {
  const dir = ensurePlannerDir()
  const filename = `planner-${sessionId}.json`
  const filepath = path.join(dir, filename)

  const existing = readExistingConversation(filepath)

  const data: PlannerConversationFile = {
    sessionId,
    messages,
    debugEvents,
    updatedAt: new Date().toISOString(),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  }

  fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
  return filepath
}

export function listPlannerConversations(): { filename: string; timestamp: string }[] {
  const dir = ensurePlannerDir()
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().reverse()
  return files.map(f => {
    try {
      const raw = fs.readFileSync(path.join(dir, f), 'utf-8')
      const data = JSON.parse(raw) as PlannerConversationFile
      return { filename: f, timestamp: data.updatedAt || f }
    } catch {
      return { filename: f, timestamp: f }
    }
  })
}

export function readPlannerConversation(
  filename: string,
): { messages: PlannerChatMessage[]; debugEvents: PlannerDebugEvent[] } | null {
  const dir = ensurePlannerDir()
  const filepath = path.join(dir, filename)
  try {
    const raw = fs.readFileSync(filepath, 'utf-8')
    const data = JSON.parse(raw) as PlannerConversationFile
    return { messages: data.messages, debugEvents: data.debugEvents }
  } catch {
    return null
  }
}
