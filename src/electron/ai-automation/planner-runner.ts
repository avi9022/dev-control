import { spawn } from 'child_process'
import { BrowserWindow, app } from 'electron'
import path from 'path'
import fs from 'fs'
import { ipcWebContentsSend } from '../utils/ipc-handle.js'
import { PLANNER_SYSTEM_PROMPT } from './planner-prompt.js'
import { getMcpPort } from './mcp-server.js'

let mainWindow: BrowserWindow | null = null

export function setPlannerMainWindow(window: BrowserWindow) {
  mainWindow = window
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

function getClaudePath(): string {
  const paths = ['/usr/local/bin/claude', '/opt/homebrew/bin/claude']
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) return p
    } catch { /* ignore */ }
  }
  return 'claude'
}

function getMcpConfigPath(): string | null {
  const port = getMcpPort()
  if (!port) return null

  const configPath = path.join(app.getPath('userData'), 'planner-mcp-config.json')
  fs.writeFileSync(configPath, JSON.stringify({
    mcpServers: {
      devcontrol: {
        type: 'http',
        url: `http://127.0.0.1:${port}/mcp`,
      }
    }
  }, null, 2))
  return configPath
}

/**
 * Send a message to the planner agent and get a streamed response.
 * Each call includes the full conversation history.
 */
export async function sendPlannerMessage(
  conversation: ChatMessage[],
  cwd: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const conversationText = conversation.map(msg =>
      msg.role === 'user' ? `Human: ${msg.content}` : `Assistant: ${msg.content}`
    ).join('\n\n')

    const fullPrompt = `${conversationText}\n\nAssistant:`

    const args = [
      '--print',
      '--output-format', 'text',
      '--system-prompt', PLANNER_SYSTEM_PROMPT,
      '-p', fullPrompt,
    ]

    const mcpConfig = getMcpConfigPath()
    if (mcpConfig) {
      args.push('--mcp-config', mcpConfig)
    }

    const claudePath = getClaudePath()
    const child = spawn(claudePath, args, {
      cwd,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let output = ''
    let error = ''

    child.stdout.on('data', (data: Buffer) => {
      const chunk = data.toString()
      output += chunk
      if (mainWindow && !mainWindow.isDestroyed()) {
        ipcWebContentsSend('aiPlannerChunk', mainWindow.webContents, chunk)
      }
    })

    child.stderr.on('data', (data: Buffer) => {
      error += data.toString()
    })

    child.on('close', (code) => {
      if (code === 0 || output.length > 0) {
        resolve(output.trim())
      } else {
        reject(new Error(`Planner failed (code ${code}): ${error}`))
      }
    })

    child.on('error', (err) => {
      reject(err)
    })
  })
}
