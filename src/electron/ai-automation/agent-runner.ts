import { spawn, execFileSync, type ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import treeKill from 'tree-kill'
import { app, BrowserWindow } from 'electron'
import { ipcWebContentsSend } from '../utils/ipc-handle.js'
import { getTaskById, updateTask, moveTaskPhase, getSettings } from './task-manager.js'
import { buildPrompt } from './prompt-builder.js'
import { createWorktree, generateBranchName, getDiff } from './worktree-manager.js'
import { getOrCreateTaskDir } from './task-dir-manager.js'

const runningProcesses = new Map<string, ChildProcess>()
const taskQueue: string[] = []
let mainWindow: BrowserWindow | null = null
let resolvedClaudePath: string | null = null
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

function appendTaskLog(taskId: string, text: string) {
  fs.appendFileSync(getTaskLogPath(taskId), text)
}

function getClaudePath(): string {
  if (resolvedClaudePath) return resolvedClaudePath
  try {
    resolvedClaudePath = execFileSync('which', ['claude'], { encoding: 'utf-8' }).trim()
  } catch {
    resolvedClaudePath = 'claude'
  }
  return resolvedClaudePath
}

export function setAgentMainWindow(window: BrowserWindow) {
  mainWindow = window
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
  const pipeline = settings.pipeline || []

  while (taskQueue.length > 0 && runningProcesses.size < settings.maxConcurrency) {
    const taskId = taskQueue.shift()
    if (!taskId) break

    let task = getTaskById(taskId)
    if (!task) continue

    // If task is in BACKLOG, move to first pipeline phase
    if (task.phase === 'BACKLOG' && pipeline.length > 0) {
      moveTaskPhase(taskId, pipeline[0].id)
      task = getTaskById(taskId)
      if (!task) continue
    }

    // Look up current phase config
    const phaseConfig = pipeline.find(p => p.id === task!.phase)
    if (!phaseConfig || phaseConfig.type !== 'agent') continue

    spawnAgent(taskId, phaseConfig)
  }
}

function emit(taskId: string, text: string) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    ipcWebContentsSend('aiTaskOutput', mainWindow.webContents, { taskId, output: text })
  }
}

function formatToolUse(block: Record<string, unknown>): string {
  const name = block.name as string
  const input = block.input as Record<string, unknown> | undefined
  let detail = ''
  if (input) {
    if (name === 'Read' && input.file_path) detail = ` → ${input.file_path}`
    else if (name === 'Edit' && input.file_path) detail = ` → ${input.file_path}`
    else if (name === 'Write' && input.file_path) detail = ` → ${input.file_path}`
    else if ((name === 'Bash' || name === 'bash') && input.command) {
      const cmd = (input.command as string).slice(0, 100)
      detail = ` → ${cmd}${(input.command as string).length > 100 ? '...' : ''}`
    }
    else if (name === 'Grep' && input.pattern) detail = ` → "${input.pattern}"`
    else if (name === 'Glob' && input.pattern) detail = ` → "${input.pattern}"`
  }
  return `\n🔧 ${name}${detail}\n`
}

function formatStreamEvent(event: Record<string, unknown>): string | null {
  const type = event.type as string | undefined

  // --- Claude Code CLI events (assistant turns with full content) ---
  if (type === 'assistant') {
    const message = event.message as Record<string, unknown> | undefined
    if (!message) return null
    const content = message.content as Array<Record<string, unknown>> | undefined
    if (!content) return null

    const parts: string[] = []
    for (const block of content) {
      if (block.type === 'text' && block.text) {
        parts.push(block.text as string)
      } else if (block.type === 'tool_use') {
        parts.push(formatToolUse(block))
      }
    }
    return parts.length > 0 ? parts.join('') : null
  }

  // Tool result events
  if (type === 'tool') {
    return null
  }

  // --- Anthropic API streaming events ---
  if (type === 'content_block_start') {
    const block = event.content_block as Record<string, unknown> | undefined
    if (block?.type === 'tool_use') return `\n🔧 ${block.name as string}\n`
    return null
  }

  if (type === 'content_block_delta') {
    const delta = event.delta as Record<string, unknown> | undefined
    if (delta?.type === 'text_delta') return delta.text as string
    return null
  }

  if (type === 'content_block_stop' || type === 'message_start' || type === 'message_delta' || type === 'message_stop') {
    return null
  }

  // --- Result & system events ---
  if (type === 'result') {
    const parts: string[] = []
    const resultText = event.result as string | undefined
    if (resultText) parts.push(`\n${resultText}\n`)
    if (event.cost_usd !== undefined) {
      const cost = (event.cost_usd as number).toFixed(4)
      const duration = event.duration_ms ? ` | ${((event.duration_ms as number) / 1000).toFixed(1)}s` : ''
      parts.push(`💰 Cost: $${cost}${duration}\n`)
    }
    return parts.length > 0 ? parts.join('') : null
  }

  if (type === 'system') {
    const subtype = event.subtype as string | undefined
    if (subtype === 'init') return '⚡ Agent initialized\n'
    const msg = event.message as string | undefined
    if (msg) return `[system] ${msg}\n`
    return null
  }

  if (type === 'error') {
    const err = event.error as Record<string, unknown> | undefined
    return `\n❌ Error: ${err?.message || JSON.stringify(event)}\n`
  }

  console.log(`[ai-agent] Unhandled event type: ${type}`, JSON.stringify(event).slice(0, 300))
  return null
}

function spawnAgent(taskId: string, phaseConfig: AIPipelinePhase) {
  let task = getTaskById(taskId)
  if (!task) return

  const settings = getSettings()

  // Create worktree on first agent phase if needed
  if (task.worktrees.length === 0 && task.projectPaths?.[0] && task.gitStrategy !== 'none') {
    const branchName = task.customBranchName || generateBranchName(taskId, task.title)
    const baseBranch = task.baseBranch || settings.defaultBaseBranch || undefined
    try {
      const worktreePath = createWorktree(taskId, task.projectPaths[0], branchName, baseBranch)
      const worktree: AITaskWorktree = { projectPath: task.projectPaths[0], worktreePath, branchName }
      updateTask(taskId, { branchName, worktrees: [worktree] })
      task = getTaskById(taskId)!
      emit(taskId, `\n📁 Created worktree: ${worktreePath} (branch: ${branchName} from ${baseBranch || 'auto'})\n`)
    } catch (err) {
      emit(taskId, `\n⚠️ Git setup failed: ${(err as Error).message}. Agent will use project directory.\n`)
    }
  }

  // Ensure task directory exists
  if (!task.taskDirPath) {
    const taskDir = getOrCreateTaskDir(taskId)
    updateTask(taskId, { taskDirPath: taskDir })
    task = getTaskById(taskId)!
  }

  const systemPrompt = buildPrompt(task, phaseConfig)

  let message = task.description
  if (task.humanComments && task.humanComments.length > 0) {
    message += '\n\nHuman review comments to address:\n' + task.humanComments.map(c => `- ${c.file}:${c.line}: ${c.comment}`).join('\n')
  }

  // Tool restrictions from phase config
  const toolArgs: string[] = []
  if (phaseConfig.allowedTools) {
    toolArgs.push('--allowedTools', phaseConfig.allowedTools)
  }

  // Add task directory and extra project paths
  const addDirArgs: string[] = []
  if (task.taskDirPath) {
    addDirArgs.push('--add-dir', task.taskDirPath)
  }
  if (task.projectPaths && task.projectPaths.length > 1) {
    for (const p of task.projectPaths.slice(1)) {
      addDirArgs.push('--add-dir', p)
    }
  }

  const args = [
    '--print',
    '--verbose',
    '--output-format', 'stream-json',
    '--dangerously-skip-permissions',
    '--system-prompt', systemPrompt,
    ...toolArgs,
    ...addDirArgs,
    '--',
    message,
  ]

  // Determine working directory
  let cwd: string
  if (task.worktrees.length > 0) {
    cwd = task.worktrees[0].worktreePath
  } else {
    cwd = task.projectPaths?.[0] || process.cwd()
  }

  const claudePath = getClaudePath()
  console.log(`[ai-agent] Spawning ${claudePath} for task ${taskId} (phase: ${phaseConfig.name}), cwd: ${cwd}, worktrees: ${task.worktrees.length}`)

  const child = spawn(claudePath, args, {
    cwd,
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe']
  })

  runningProcesses.set(taskId, child)
  updateTask(taskId, { activeProcessPid: child.pid, currentPhaseName: phaseConfig.name })

  // Close stdin for --print mode
  child.stdin?.end()

  let fullOutput = ''
  const roleHeader = `\n--- ${phaseConfig.name.toUpperCase()} AGENT ---\n`
  appendTaskLog(taskId, roleHeader)
  emit(taskId, roleHeader)

  let stdoutBuffer = ''

  const emitText = (text: string) => {
    fullOutput += text
    appendTaskLog(taskId, text)
    emit(taskId, text)
  }

  child.stdout?.on('data', (data: Buffer) => {
    stdoutBuffer += data.toString()
    const lines = stdoutBuffer.split('\n')
    stdoutBuffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const event = JSON.parse(line)
        const formatted = formatStreamEvent(event)
        if (formatted) {
          emitText(formatted)
        }
      } catch {
        emitText(line + '\n')
      }
    }
  })

  child.stderr?.on('data', (data: Buffer) => {
    const text = data.toString()
    emitText(`[stderr] ${text}`)
  })

  child.on('exit', (code) => {
    if (stdoutBuffer.trim()) {
      try {
        const event = JSON.parse(stdoutBuffer)
        const formatted = formatStreamEvent(event)
        if (formatted) emitText(formatted)
      } catch {
        emitText(stdoutBuffer)
      }
    }
    console.log(`[ai-agent] Agent exited for task ${taskId} (phase: ${phaseConfig.name}) with code ${code}`)
    runningProcesses.delete(taskId)
    updateTask(taskId, { activeProcessPid: undefined, currentPhaseName: undefined })
    handleAgentCompletion(taskId, phaseConfig, fullOutput, code)
    processQueue()
  })

  child.on('error', (err) => {
    const errorMsg = `Failed to spawn claude for task ${taskId}: ${err.message}`
    console.error(`[ai-agent] ${errorMsg}`)
    const errorText = `\n[ERROR] ${errorMsg}\n`
    appendTaskLog(taskId, errorText)
    emit(taskId, errorText)
    runningProcesses.delete(taskId)
    updateTask(taskId, { activeProcessPid: undefined, currentPhaseName: undefined, needsUserInput: true })
  })
}

function handleAgentCompletion(taskId: string, phaseConfig: AIPipelinePhase, output: string, exitCode: number | null) {
  const task = getTaskById(taskId)
  if (!task) return

  if (exitCode !== 0 && exitCode !== null) {
    updateTask(taskId, { needsUserInput: true })
    return
  }

  const settings = getSettings()
  const pipeline = settings.pipeline || []
  const currentIndex = pipeline.findIndex(p => p.id === phaseConfig.id)

  // Check for reject pattern
  if (phaseConfig.rejectPattern && output.includes(phaseConfig.rejectPattern) && phaseConfig.rejectTarget) {
    const targetExists = pipeline.some(p => p.id === phaseConfig.rejectTarget)
    if (targetExists) {
      moveTaskPhase(taskId, phaseConfig.rejectTarget!)
      enqueueTask(taskId)
      return
    }
  }

  // Move to next phase
  const nextIndex = currentIndex + 1
  if (nextIndex < pipeline.length) {
    moveTaskPhase(taskId, pipeline[nextIndex].id)
    if (pipeline[nextIndex].type === 'agent') {
      enqueueTask(taskId)
    }
  } else {
    moveTaskPhase(taskId, 'DONE')
  }
}
