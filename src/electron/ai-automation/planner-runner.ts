import { type ChildProcess, spawn } from 'child_process'
import { BrowserWindow, app } from 'electron'
import path from 'path'
import fs from 'fs'
import treeKill from 'tree-kill'
import { ipcWebContentsSend } from '../utils/ipc-handle.js'
import { PLANNER_SYSTEM_PROMPT } from './planner-prompt.js'
import { getMcpPort } from './mcp-server.js'
import { mcpTools } from './mcp-tools/index.js'
import { getClaudePath } from './claude-path.js'

const HUMAN_ROLE_PREFIX = 'Human: '
const ASSISTANT_ROLE_PREFIX = 'Assistant: '
const ASSISTANT_SUFFIX = '\n\nAssistant:'
const MCP_SERVER_NAME = 'devcontrol'

let mainWindow: BrowserWindow | null = null

/** Active planner processes keyed by a unique call ID */
const activePlannerProcesses = new Map<string, ChildProcess>()

export interface PlannerChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface PlannerDebugEvent {
  type: string
  [key: string]: unknown
}

interface PlannerStreamAssistantBlock {
  type: 'text'
  text: string
}

interface PlannerStreamAssistantEvent {
  type: 'assistant'
  message?: { content?: PlannerStreamAssistantBlock[] }
}

interface PlannerStreamDeltaEvent {
  type: 'content_block_delta'
  delta?: { text?: string }
}

type PlannerStreamEvent = PlannerStreamAssistantEvent | PlannerStreamDeltaEvent | PlannerDebugEvent

export function setPlannerMainWindow(window: BrowserWindow): void {
  mainWindow = window
}

function getMcpConfigPath(): string | null {
  const port = getMcpPort()
  if (!port) return null

  const configPath = path.join(app.getPath('userData'), 'planner-mcp-config.json')
  fs.writeFileSync(configPath, JSON.stringify({
    mcpServers: {
      [MCP_SERVER_NAME]: {
        type: 'http',
        url: `http://127.0.0.1:${port}/mcp`,
      }
    }
  }, null, 2))
  return configPath
}

/**
 * Kill a planner process by its call ID.
 */
export function killPlannerProcess(callId: string): void {
  const child = activePlannerProcesses.get(callId)
  if (!child || !child.pid) return
  treeKill(child.pid, 'SIGTERM', (err) => {
    if (err && child.pid) {
      treeKill(child.pid, 'SIGKILL')
    }
  })
  activePlannerProcesses.delete(callId)
}

/**
 * Kill all active planner processes. Called on app quit.
 */
export function killAllPlannerProcesses(): void {
  for (const [callId] of activePlannerProcesses) {
    killPlannerProcess(callId)
  }
}

/**
 * Send a message to the planner agent and get a streamed response.
 * Each call includes the full conversation history.
 */
export async function sendPlannerMessage(
  conversation: PlannerChatMessage[],
  cwd: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const conversationText = conversation.map(msg =>
      msg.role === 'user' ? `${HUMAN_ROLE_PREFIX}${msg.content}` : `${ASSISTANT_ROLE_PREFIX}${msg.content}`
    ).join('\n\n')

    const fullPrompt = `${conversationText}${ASSISTANT_SUFFIX}`

    const args = [
      '--print',
      '--verbose',
      '--output-format', 'stream-json',
      '--system-prompt', PLANNER_SYSTEM_PROMPT,
      '-p', fullPrompt,
    ]

    const mcpConfig = getMcpConfigPath()
    if (mcpConfig) {
      args.push('--mcp-config', mcpConfig)
      const allowedTools = mcpTools.map(t => `mcp__${MCP_SERVER_NAME}__${t.name}`).join(',')
      args.push('--allowedTools', allowedTools)
    }

    const claudePath = getClaudePath()
    const child = spawn(claudePath, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const callId = `planner-${Date.now()}`
    activePlannerProcesses.set(callId, child)

    let assistantText = ''
    let error = ''
    let buffer = ''

    child.stdout.on('data', (data: Buffer) => {
      buffer += data.toString()
      // Process complete JSON lines
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // keep incomplete line

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const event: PlannerStreamEvent = JSON.parse(line)

          // Send all events to debug panel
          if (mainWindow && !mainWindow.isDestroyed()) {
            ipcWebContentsSend('aiPlannerDebug', mainWindow.webContents, event)
          }

          // Extract assistant text for the chat
          if (event.type === 'assistant') {
            const assistantEvent = event as PlannerStreamAssistantEvent
            if (assistantEvent.message?.content) {
              for (const block of assistantEvent.message.content) {
                if (block.type === 'text') {
                  assistantText = block.text
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    ipcWebContentsSend('aiPlannerChunk', mainWindow.webContents, block.text)
                  }
                }
              }
            }
          }

          // Content block delta — streaming text
          if (event.type === 'content_block_delta') {
            const deltaEvent = event as PlannerStreamDeltaEvent
            if (deltaEvent.delta?.text) {
              assistantText += deltaEvent.delta.text
              if (mainWindow && !mainWindow.isDestroyed()) {
                ipcWebContentsSend('aiPlannerChunk', mainWindow.webContents, deltaEvent.delta.text)
              }
            }
          }
        } catch {
          // Not JSON — treat as raw text
          assistantText += line
          if (mainWindow && !mainWindow.isDestroyed()) {
            ipcWebContentsSend('aiPlannerChunk', mainWindow.webContents, line)
          }
        }
      }
    })

    child.stderr.on('data', (data: Buffer) => {
      error += data.toString()
    })

    child.on('close', (code) => {
      activePlannerProcesses.delete(callId)
      if (code === 0 || assistantText.length > 0) {
        resolve(assistantText.trim())
      } else {
        reject(new Error(`Planner failed (code ${code}): ${error}`))
      }
    })

    child.on('error', (err) => {
      activePlannerProcesses.delete(callId)
      reject(err)
    })
  })
}
