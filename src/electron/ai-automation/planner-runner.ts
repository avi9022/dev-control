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
      '--verbose',
      '--output-format', 'stream-json',
      '--system-prompt', PLANNER_SYSTEM_PROMPT,
      '-p', fullPrompt,
    ]

    const mcpConfig = getMcpConfigPath()
    if (mcpConfig) {
      args.push('--mcp-config', mcpConfig)
      args.push('--allowedTools', 'mcp__devcontrol__create_task,mcp__devcontrol__create_board,mcp__devcontrol__list_boards,mcp__devcontrol__list_knowledge_docs,mcp__devcontrol__read_knowledge_doc,mcp__devcontrol__list_projects,mcp__devcontrol__list_comments,mcp__devcontrol__resolve_comment')
    }

    const claudePath = getClaudePath()
    const child = spawn(claudePath, args, {
      cwd,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

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
          const event = JSON.parse(line)

          // Send all events to debug panel
          if (mainWindow && !mainWindow.isDestroyed()) {
            ipcWebContentsSend('aiPlannerDebug', mainWindow.webContents, event)
          }

          // Extract assistant text for the chat
          if (event.type === 'assistant' && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === 'text') {
                assistantText = block.text
                if (mainWindow && !mainWindow.isDestroyed()) {
                  ipcWebContentsSend('aiPlannerChunk', mainWindow.webContents, block.text)
                }
              }
            }
          }

          // Content block delta — streaming text
          if (event.type === 'content_block_delta' && event.delta?.text) {
            assistantText += event.delta.text
            if (mainWindow && !mainWindow.isDestroyed()) {
              ipcWebContentsSend('aiPlannerChunk', mainWindow.webContents, event.delta.text)
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
      if (code === 0 || assistantText.length > 0) {
        resolve(assistantText.trim())
      } else {
        reject(new Error(`Planner failed (code ${code}): ${error}`))
      }
    })

    child.on('error', (err) => {
      reject(err)
    })
  })
}
