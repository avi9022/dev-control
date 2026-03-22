import { app } from 'electron'
import path from 'path'
import fs from 'fs'

const PLANNER_DIR = 'planner-history'

function ensurePlannerDir(): string {
  const dir = path.join(app.getPath('userData'), PLANNER_DIR)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function savePlannerConversation(sessionId: string, messages: { role: string; content: string }[], debugEvents: unknown[]): string {
  const dir = ensurePlannerDir()
  const filename = `planner-${sessionId}.json`
  const filepath = path.join(dir, filename)

  fs.writeFileSync(filepath, JSON.stringify({
    sessionId,
    messages,
    debugEvents,
    updatedAt: new Date().toISOString(),
    createdAt: fs.existsSync(filepath) ? JSON.parse(fs.readFileSync(filepath, 'utf-8')).createdAt : new Date().toISOString(),
  }, null, 2))
  return filepath
}

export function listPlannerConversations(): { filename: string; timestamp: string }[] {
  const dir = ensurePlannerDir()
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().reverse()
  return files.map(f => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'))
      return { filename: f, timestamp: data.updatedAt || f }
    } catch {
      return { filename: f, timestamp: f }
    }
  })
}

export function readPlannerConversation(filename: string): { messages: { role: string; content: string }[]; debugEvents: unknown[] } | null {
  const dir = ensurePlannerDir()
  const filepath = path.join(dir, filename)
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'))
  } catch {
    return null
  }
}
