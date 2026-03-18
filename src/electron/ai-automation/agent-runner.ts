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

const ROLE_TOOLS: Record<string, string[]> = {
  worker:   ['Bash', 'Edit', 'Write', 'Read', 'Grep', 'Glob'],
  planner:  ['Read', 'Grep', 'Glob', 'Write'],
  reviewer: ['Read', 'Grep', 'Glob'],
  git:      ['Bash(git *)'],
}

const runningProcesses = new Map<string, ChildProcess>()
const agentStats = new Map<string, AIAgentStats>()
const taskQueue: string[] = []
let mainWindow: BrowserWindow | null = null
let resolvedClaudePath: string | null = null
let aiLogsDir: string | null = null
let guardScriptPath: string | null = null

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

function getGuardScriptPath(): string {
  if (guardScriptPath) return guardScriptPath
  const dir = path.join(app.getPath('userData'), 'ai-scripts')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  guardScriptPath = path.join(dir, 'ai-guard.sh')

  const script = `#!/bin/bash
INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')

if [ -z "$ALLOWED_WRITE_DIR" ]; then
  exit 0
fi

get_path() {
  echo "$INPUT" | jq -r "$1 // empty"
}

resolve_path() {
  local raw="$1"
  local dir="$raw"
  while [ ! -d "$dir" ] && [ "$dir" != "/" ]; do
    dir=$(dirname "$dir")
  done
  local resolved
  resolved=$(cd "$dir" 2>/dev/null && echo "$(pwd -P)/$(basename "$raw")")
  [ -z "$resolved" ] && resolved=$(realpath -m "$raw" 2>/dev/null || echo "$raw")
  echo "$resolved"
}

check_write() {
  local raw="$1"
  [ -z "$raw" ] && return 0
  local resolved
  resolved=$(resolve_path "$raw")
  local write_real
  write_real=$(cd "$ALLOWED_WRITE_DIR" 2>/dev/null && pwd -P)
  [ -z "$write_real" ] && return 1
  case "$resolved" in
    "$write_real"*) return 0 ;;
    *) return 1 ;;
  esac
}

check_read() {
  local raw="$1"
  [ -z "$raw" ] && return 0
  local resolved
  resolved=$(resolve_path "$raw")

  # Check write dir first
  local write_real
  write_real=$(cd "$ALLOWED_WRITE_DIR" 2>/dev/null && pwd -P)
  if [ -n "$write_real" ]; then
    case "$resolved" in
      "$write_real"*) return 0 ;;
    esac
  fi

  # Check read dirs
  IFS=',' read -ra DIRS <<< "$ALLOWED_READ_DIRS"
  for dir in "\${DIRS[@]}"; do
    [ -z "$dir" ] && continue
    local dir_real
    dir_real=$(cd "$dir" 2>/dev/null && pwd -P)
    [ -z "$dir_real" ] && continue
    case "$resolved" in
      "$dir_real"*) return 0 ;;
    esac
  done
  return 1
}

case "$TOOL" in
  Edit|Write)
    FILE=$(get_path '.tool_input.file_path')
    if ! check_write "$FILE"; then
      echo "Blocked: $FILE is outside writable directory" >&2
      exit 2
    fi
    ;;
  Read)
    FILE=$(get_path '.tool_input.file_path')
    if ! check_read "$FILE"; then
      echo "Blocked: $FILE is outside allowed directories" >&2
      exit 2
    fi
    ;;
  Grep|Glob)
    DIR=$(get_path '.tool_input.path')
    if [ -n "$DIR" ] && ! check_read "$DIR"; then
      echo "Blocked: $DIR is outside allowed directories" >&2
      exit 2
    fi
    ;;
esac

exit 0
`
  fs.writeFileSync(guardScriptPath, script, { mode: 0o755 })
  return guardScriptPath
}

function buildAllowedTools(phaseConfig: AIPipelinePhase): string[] {
  // Legacy support: if old allowedTools string exists and no roles, use it
  if (phaseConfig.allowedTools && (!phaseConfig.roles || phaseConfig.roles.length === 0) && !phaseConfig.customTools) {
    return phaseConfig.allowedTools.split(',').map(t => t.trim()).filter(Boolean)
  }

  const tools = new Set<string>()

  // Add tools from selected roles
  if (phaseConfig.roles) {
    for (const role of phaseConfig.roles) {
      const roleTools = ROLE_TOOLS[role]
      if (roleTools) {
        for (const tool of roleTools) tools.add(tool)
      }
    }
  }

  // Add custom tools
  if (phaseConfig.customTools) {
    const custom = phaseConfig.customTools.split(/[,\s]+/).filter(Boolean)
    for (const tool of custom) tools.add(tool)
  }

  return [...tools]
}

export function setAgentMainWindow(window: BrowserWindow) {
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
    // Log the manual stop in phase history
    const task = getTaskById(taskId)
    if (task) {
      const history = [...task.phaseHistory]
      if (history.length > 0) {
        history[history.length - 1] = {
          ...history[history.length - 1],
          exitedAt: new Date().toISOString(),
          exitEvent: 'stopped',
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

function emitStats(taskId: string) {
  const stats = agentStats.get(taskId)
  if (stats && mainWindow && !mainWindow.isDestroyed()) {
    ipcWebContentsSend('aiAgentStats', mainWindow.webContents, stats)
  }
}

// Context window sizes by model family
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'claude-opus-4': 200000,
  'claude-sonnet-4': 200000,
  'claude-haiku-4': 200000,
  'claude-3-5': 200000,
  'claude-3': 200000,
}

function getContextWindowForModel(model: string): number {
  for (const [prefix, size] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
    if (model.startsWith(prefix)) return size
  }
  return 200000 // default
}

function initStats(taskId: string): AIAgentStats {
  const stats: AIAgentStats = {
    taskId,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    contextWindowMax: 200000,
    peakContext: 0,
    turns: 0,
    toolCalls: 0,
    toolNames: [],
    costUsd: 0,
    startedAt: new Date().toISOString(),
  }
  agentStats.set(taskId, stats)
  return stats
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

  if (type === 'content_block_stop' || type === 'message_stop') {
    return null
  }

  // Extract usage data from message events (don't display, but return for stats tracking)
  if (type === 'message_start' || type === 'message_delta') {
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

  // Create worktrees on first agent phase for all projects with worktree strategy
  if (task.worktrees.length === 0 && task.projects.length > 0) {
    const newWorktrees: AITaskWorktree[] = []
    for (const project of task.projects) {
      if (project.gitStrategy !== 'worktree') continue
      const branchName = project.customBranchName || generateBranchName(taskId, task.title)
      const baseBranch = project.baseBranch || settings.defaultBaseBranch || undefined
      try {
        const worktreePath = createWorktree(taskId, project.path, branchName, baseBranch)
        newWorktrees.push({ projectPath: project.path, worktreePath, branchName })
        emit(taskId, `\n📁 Created worktree: ${worktreePath} (branch: ${branchName} from ${baseBranch || 'auto'})\n`)
      } catch (err) {
        emit(taskId, `\n⚠️ Git setup failed for ${project.label}: ${(err as Error).message}. Agent will use project directory.\n`)
      }
    }
    if (newWorktrees.length > 0) {
      updateTask(taskId, { worktrees: newWorktrees })
      task = getTaskById(taskId)!
    }
  }

  // Ensure task directory exists
  if (!task.taskDirPath) {
    const taskDir = getOrCreateTaskDir(taskId)
    updateTask(taskId, { taskDirPath: taskDir })
    task = getTaskById(taskId)!
  }

  const systemPrompt = buildPrompt(task, phaseConfig)

  // Save context history: prompt + events directory
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const contextHistoryDir = path.join(task.taskDirPath!, 'context-history', `${phaseConfig.id}-${timestamp}`)
  fs.mkdirSync(contextHistoryDir, { recursive: true })
  fs.writeFileSync(path.join(contextHistoryDir, 'prompt.md'), systemPrompt)
  fs.writeFileSync(path.join(contextHistoryDir, 'events.json'), '[\n')

  // Update the current phase history entry with contextHistoryPath
  const phaseHistory = [...task.phaseHistory]
  if (phaseHistory.length > 0) {
    const lastEntry = phaseHistory[phaseHistory.length - 1]
    if (lastEntry.phase === phaseConfig.id && !lastEntry.exitedAt) {
      phaseHistory[phaseHistory.length - 1] = { ...lastEntry, contextHistoryPath: contextHistoryDir }
      updateTask(taskId, { phaseHistory })
      task = getTaskById(taskId)!
    }
  }

  let eventCount = 0
  const appendEvent = (event: Record<string, unknown>) => {
    try {
      const prefix = eventCount > 0 ? ',\n' : ''
      fs.appendFileSync(path.join(contextHistoryDir, 'events.json'), prefix + JSON.stringify(event))
      eventCount++
    } catch { /* */ }
  }
  const finalizeEvents = () => {
    try {
      fs.appendFileSync(path.join(contextHistoryDir, 'events.json'), '\n]')
    } catch { /* */ }
  }

  let message = task.description
  if (task.humanComments && task.humanComments.length > 0) {
    message += '\n\nHuman review comments to address:\n' + task.humanComments.map(c => `- ${c.file}:${c.line}: ${c.comment}`).join('\n')
  }

  // Tool restrictions from roles + custom tools
  const allowedTools = buildAllowedTools(phaseConfig)
  const toolArgs: string[] = []
  if (allowedTools.length > 0) {
    toolArgs.push('--allowedTools', allowedTools.join(','))
  }

  // Guard hook: restrict file operations to task directory
  const guardScript = getGuardScriptPath()
  const guardSettings = JSON.stringify({
    hooks: {
      PreToolUse: [{
        matcher: 'Edit|Write|Read|Grep|Glob',
        hooks: [{
          type: 'command',
          command: guardScript
        }]
      }]
    }
  })

  // Add task directory, additional worktrees, and read-only project paths
  const addDirArgs: string[] = []
  if (task.taskDirPath) {
    addDirArgs.push('--add-dir', task.taskDirPath)
  }
  // Add worktrees beyond the first (first is CWD)
  for (const wt of task.worktrees.slice(1)) {
    addDirArgs.push('--add-dir', wt.worktreePath)
  }
  // Add read-only project paths
  const readOnlyPaths: string[] = []
  for (const project of task.projects) {
    if (project.gitStrategy === 'none') {
      addDirArgs.push('--add-dir', project.path)
      readOnlyPaths.push(project.path)
    }
  }

  const args = [
    '--print',
    '--verbose',
    '--output-format', 'stream-json',
    '--dangerously-skip-permissions',
    '--system-prompt', systemPrompt,
    '--settings', guardSettings,
    ...toolArgs,
    ...addDirArgs,
    '--',
    message,
  ]

  // Determine working directory
  let cwd: string
  if (task.worktrees.length > 0) {
    cwd = task.worktrees[0].worktreePath
  } else if (task.projects.length > 0) {
    cwd = task.projects[0].path
  } else {
    cwd = process.cwd()
  }

  const claudePath = getClaudePath()
  console.log(`[ai-agent] Spawning ${claudePath} for task ${taskId} (phase: ${phaseConfig.name}), cwd: ${cwd}, worktrees: ${task.worktrees.length}`)

  const child = spawn(claudePath, args, {
    cwd,
    env: {
      ...process.env,
      ALLOWED_WRITE_DIR: task.taskDirPath || '',
      ALLOWED_READ_DIRS: [task.taskDirPath || '', ...readOnlyPaths].filter(Boolean).join(','),
    },
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
  const stats = initStats(taskId)

  // Stall detection
  let lastEventTime = Date.now()
  const stallTimeoutMs = ((phaseConfig.stallTimeout ?? settings.stallTimeoutMinutes ?? 3) * 60 * 1000)
  const stallCheckInterval = setInterval(() => {
    const elapsed = Date.now() - lastEventTime
    if (elapsed > stallTimeoutMs) {
      clearInterval(stallCheckInterval)
      const currentTask = getTaskById(taskId)
      if (!currentTask) return
      const retryCount = (currentTask.stallRetryCount || 0) + 1
      const maxRetries = 3

      emit(taskId, `\n⚠️ Agent stalled (no events for ${Math.round(elapsed / 60000)}min)\n`)

      // Log stall in phase history
      const history = [...currentTask.phaseHistory]
      if (history.length > 0) {
        history[history.length - 1] = {
          ...history[history.length - 1],
          exitedAt: new Date().toISOString(),
          exitEvent: 'stalled',
        }
      }

      // Kill the process
      const proc = runningProcesses.get(taskId)
      if (proc && proc.pid) {
        try { treeKill(proc.pid, 'SIGKILL') } catch { /* */ }
      }
      runningProcesses.delete(taskId)

      if (retryCount < maxRetries) {
        emit(taskId, `⚠️ Retrying phase (attempt ${retryCount + 1}/${maxRetries})...\n`)
        updateTask(taskId, {
          activeProcessPid: undefined,
          currentPhaseName: undefined,
          stallRetryCount: retryCount,
          phaseHistory: history,
        })
        enqueueTask(taskId)
      } else {
        emit(taskId, `⚠️ Max retries reached — needs attention\n`)
        updateTask(taskId, {
          activeProcessPid: undefined,
          currentPhaseName: undefined,
          needsUserInput: true,
          needsUserInputReason: 'max_retries',
          stallRetryCount: retryCount,
          phaseHistory: history,
        })
      }
    }
  }, 30000)

  const emitText = (text: string) => {
    fullOutput += text
    appendTaskLog(taskId, text)
    emit(taskId, text)
  }

  const updateStatsFromEvent = (event: Record<string, unknown>) => {
    const type = event.type as string

    // assistant events carry usage, model, and tool calls in content
    if (type === 'assistant') {
      const message = event.message as Record<string, unknown> | undefined
      if (!message) return

      const model = message.model as string | undefined
      if (model) stats.contextWindowMax = getContextWindowForModel(model)

      const usage = message.usage as Record<string, number> | undefined
      if (usage) {
        const raw = usage.input_tokens || 0
        const cacheCreate = usage.cache_creation_input_tokens || 0
        const cacheRead = usage.cache_read_input_tokens || 0
        const turnTotal = raw + cacheCreate + cacheRead

        stats.inputTokens = turnTotal
        if (turnTotal > stats.peakContext) stats.peakContext = turnTotal
        stats.cacheCreationTokens = cacheCreate
        stats.cacheReadTokens = cacheRead
        stats.outputTokens += usage.output_tokens || 0
      }

      // Count tool calls from content blocks
      const content = message.content as Record<string, unknown>[] | undefined
      if (content) {
        for (const block of content) {
          if (block.type === 'tool_use') {
            stats.toolCalls++
            const name = block.name as string
            if (name && !stats.toolNames.includes(name)) stats.toolNames.push(name)
          }
        }
      }

      stats.turns++
      emitStats(taskId)
    }

    // Final cost from result event
    if (type === 'result') {
      if (event.cost_usd !== undefined) {
        stats.costUsd = event.cost_usd as number
      }
      emitStats(taskId)
    }
  }

  child.stdout?.on('data', (data: Buffer) => {
    stdoutBuffer += data.toString()
    const lines = stdoutBuffer.split('\n')
    stdoutBuffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const event = JSON.parse(line)
        lastEventTime = Date.now()
        // Save assistant, user, result, error events to context history
        const evType = event.type as string
        if (evType === 'assistant' || evType === 'user' || evType === 'result' || evType === 'error') {
          appendEvent(event)
        }
        updateStatsFromEvent(event)
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
    clearInterval(stallCheckInterval)
    if (stdoutBuffer.trim()) {
      try {
        const event = JSON.parse(stdoutBuffer)
        const evType = event.type as string
        if (evType === 'assistant' || evType === 'user' || evType === 'result' || evType === 'error') {
          appendEvent(event)
        }
        const formatted = formatStreamEvent(event)
        if (formatted) emitText(formatted)
      } catch {
        emitText(stdoutBuffer)
      }
    }
    finalizeEvents()
    console.log(`[ai-agent] Agent exited for task ${taskId} (phase: ${phaseConfig.name}) with code ${code}`)
    runningProcesses.delete(taskId)
    updateTask(taskId, { activeProcessPid: undefined, currentPhaseName: undefined })
    handleAgentCompletion(taskId, phaseConfig, fullOutput, code)
    processQueue()
  })

  child.on('error', (err) => {
    clearInterval(stallCheckInterval)
    const errorMsg = `Failed to spawn claude for task ${taskId}: ${err.message}`
    console.error(`[ai-agent] ${errorMsg}`)
    const errorText = `\n[ERROR] ${errorMsg}\n`
    appendTaskLog(taskId, errorText)
    emit(taskId, errorText)
    runningProcesses.delete(taskId)
    const errTask = getTaskById(taskId)
    const errHistory = errTask ? [...errTask.phaseHistory] : []
    if (errHistory.length > 0) {
      errHistory[errHistory.length - 1] = { ...errHistory[errHistory.length - 1], exitedAt: new Date().toISOString(), exitEvent: 'error' }
    }
    updateTask(taskId, { activeProcessPid: undefined, currentPhaseName: undefined, needsUserInput: true, needsUserInputReason: 'error', phaseHistory: errHistory })
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

  // Reset stall retry count on successful completion
  updateTask(taskId, { stallRetryCount: 0 })

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
