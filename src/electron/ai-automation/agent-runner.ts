import { spawn, type ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import treeKill from 'tree-kill'
import { app, BrowserWindow } from 'electron'
import { ipcWebContentsSend } from '../utils/ipc-handle.js'
import { getTaskById, updateTask, moveTaskPhase, getSettings, getBoardPipeline } from './task-manager.js'
import { sendNotification } from './notification-manager.js'
import { buildPrompt } from './prompt-builder.js'
import { createWorktree, generateBranchName } from './worktree-manager.js'
import { getOrCreateTaskDir } from './task-dir-manager.js'
import { getMcpPort } from './mcp-server.js'
import { getClaudePath } from './claude-path.js'
import { getGuardScriptPath } from './guard-script.js'
import { formatStreamEvent } from './stream-formatter.js'
import {
  type ClaudeStreamEvent,
  isAssistantEvent,
  isResultEvent,
  isToolUseBlock,
  isSaveableEvent,
} from './stream-types.js'
import {
  FIXED_PHASES,
  PhaseExitEvent,
  AttentionReason,
  PhaseType,
  GIT_STRATEGY,
  DEFAULT_STALL_TIMEOUT_MINUTES,
  MAX_STALL_RETRIES,
} from '../../shared/constants.js'

// ─── Constants ───

const DEFAULT_CONTEXT_WINDOW = 200_000
const STALL_CHECK_INTERVAL_MS = 30_000

enum AgentRole {
  Worker = 'worker',
  Planner = 'planner',
  Reviewer = 'reviewer',
  Git = 'git',
}

const ROLE_TOOLS: Record<AgentRole, string[]> = {
  [AgentRole.Worker]: ['Bash', 'Edit', 'Write', 'Read', 'Grep', 'Glob'],
  [AgentRole.Planner]: ['Read', 'Grep', 'Glob', 'Write'],
  [AgentRole.Reviewer]: ['Read', 'Grep', 'Glob'],
  [AgentRole.Git]: ['Bash(git *)'],
}

// Context window sizes by model family
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'claude-opus-4': DEFAULT_CONTEXT_WINDOW,
  'claude-sonnet-4': DEFAULT_CONTEXT_WINDOW,
  'claude-haiku-4': DEFAULT_CONTEXT_WINDOW,
  'claude-3-5': DEFAULT_CONTEXT_WINDOW,
  'claude-3': DEFAULT_CONTEXT_WINDOW,
}

// ─── State ───

const runningProcesses = new Map<string, ChildProcess>()
const agentStats = new Map<string, AIAgentStats>()
const taskQueue: string[] = []
let mainWindow: BrowserWindow | null = null
let aiLogsDir: string | null = null

// ─── Logging ───

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

function appendTaskLog(taskId: string, text: string): void {
  fs.appendFileSync(getTaskLogPath(taskId), text)
}

// ─── Tool Helpers ───

function buildAllowedTools(phaseConfig: AIPipelinePhase): string[] {
  // Legacy support: if old allowedTools string exists and no roles, use it
  if (phaseConfig.allowedTools && (!phaseConfig.roles || phaseConfig.roles.length === 0) && !phaseConfig.customTools) {
    return phaseConfig.allowedTools.split(',').map(t => t.trim()).filter(Boolean)
  }

  const tools = new Set<string>()

  // Add tools from selected roles
  if (phaseConfig.roles) {
    for (const role of phaseConfig.roles) {
      const roleTools = ROLE_TOOLS[role as AgentRole]
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

// ─── Exports ───

export function setAgentMainWindow(window: BrowserWindow): void {
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
          exitEvent: PhaseExitEvent.Stopped,
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

export function sendInput(taskId: string, input: string): void {
  const proc = runningProcesses.get(taskId)
  if (proc && proc.stdin && !proc.stdin.destroyed) {
    proc.stdin.write(input)
  }
}

export function enqueueTask(taskId: string): void {
  if (!taskQueue.includes(taskId)) {
    taskQueue.push(taskId)
  }
  processQueue()
}

// ─── Internal Helpers ───

function processQueue(): void {
  const settings = getSettings()

  while (taskQueue.length > 0 && runningProcesses.size < settings.maxConcurrency) {
    const taskId = taskQueue.shift()
    if (!taskId) break

    let task = getTaskById(taskId)
    if (!task) continue

    const pipeline = getBoardPipeline(task.boardId)

    // If task is in BACKLOG, move to first pipeline phase
    if (task.phase === FIXED_PHASES.BACKLOG && pipeline.length > 0) {
      moveTaskPhase(taskId, pipeline[0].id)
      task = getTaskById(taskId)
      if (!task) continue
    }

    // Look up current phase config
    const phaseConfig = pipeline.find(p => p.id === task.phase)
    if (!phaseConfig || phaseConfig.type !== PhaseType.Agent) continue

    spawnAgent(taskId, phaseConfig)
  }
}

function emit(taskId: string, text: string): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    ipcWebContentsSend('aiTaskOutput', mainWindow.webContents, { taskId, output: text })
  }
}

function emitStats(taskId: string): void {
  const stats = agentStats.get(taskId)
  if (stats && mainWindow && !mainWindow.isDestroyed()) {
    ipcWebContentsSend('aiAgentStats', mainWindow.webContents, stats)
  }
}

function getContextWindowForModel(model: string): number {
  for (const [prefix, size] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
    if (model.startsWith(prefix)) return size
  }
  return DEFAULT_CONTEXT_WINDOW
}

function initStats(taskId: string): AIAgentStats {
  const stats: AIAgentStats = {
    taskId,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    contextWindowMax: DEFAULT_CONTEXT_WINDOW,
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

function spawnAgent(taskId: string, phaseConfig: AIPipelinePhase): void {
  let task = getTaskById(taskId)
  if (!task) return

  const settings = getSettings()

  // Create worktrees for any projects that don't have one yet
  if (task.projects.length > 0) {
    const existingWorktreePaths = new Set(task.worktrees.map(w => w.projectPath))
    const newWorktrees: AITaskWorktree[] = []
    for (const project of task.projects) {
      if (project.gitStrategy !== GIT_STRATEGY.WORKTREE) continue
      if (existingWorktreePaths.has(project.path)) continue
      const branchName = project.customBranchName || generateBranchName(taskId, task.title)
      const baseBranch = project.baseBranch || settings.defaultBaseBranch || undefined
      try {
        const worktreePath = createWorktree(taskId, project.path, branchName, baseBranch)
        newWorktrees.push({ projectPath: project.path, worktreePath, branchName })
        emit(taskId, `\n📁 Created worktree: ${worktreePath} (branch: ${branchName} from ${baseBranch || 'auto'})\n`)
      } catch (err) {
        emit(taskId, `\n⚠️ Git setup failed for ${project.label}: ${err instanceof Error ? err.message : String(err)}. Agent will use project directory.\n`)
      }
    }
    if (newWorktrees.length > 0) {
      updateTask(taskId, { worktrees: [...task.worktrees, ...newWorktrees] })
      const refreshedTask = getTaskById(taskId)
      if (!refreshedTask) return
      task = refreshedTask
    }
  }

  // Ensure task directory exists
  if (!task.taskDirPath) {
    const taskDir = getOrCreateTaskDir(taskId)
    updateTask(taskId, { taskDirPath: taskDir })
    const refreshedTask = getTaskById(taskId)
    if (!refreshedTask) return
    task = refreshedTask
  }

  const systemPrompt = buildPrompt(task, phaseConfig)

  // Save context history: prompt + events directory
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const taskDirPath = task.taskDirPath
  if (!taskDirPath) return
  const contextHistoryDir = path.join(taskDirPath, 'context-history', `${phaseConfig.id}-${timestamp}`)
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
      const refreshedTask = getTaskById(taskId)
      if (!refreshedTask) return
      task = refreshedTask
    }
  }

  let eventCount = 0
  const appendEvent = (event: ClaudeStreamEvent): void => {
    try {
      const prefix = eventCount > 0 ? ',\n' : ''
      fs.appendFileSync(path.join(contextHistoryDir, 'events.json'), prefix + JSON.stringify(event))
      eventCount++
    } catch { /* */ }
  }
  const finalizeEvents = (): void => {
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
  if (taskDirPath) {
    addDirArgs.push('--add-dir', taskDirPath)
  }
  // Add worktrees beyond the first (first is CWD)
  for (const wt of task.worktrees.slice(1)) {
    addDirArgs.push('--add-dir', wt.worktreePath)
  }
  // Add read-only project paths
  const readOnlyPaths: string[] = []
  for (const project of task.projects) {
    if (project.gitStrategy === GIT_STRATEGY.NONE) {
      addDirArgs.push('--add-dir', project.path)
      readOnlyPaths.push(project.path)
    }
  }

  // MCP config for agent tools — write to file since --mcp-config expects a path
  const mcpArgs: string[] = []
  const mcpPortNum = getMcpPort()
  if (mcpPortNum) {
    try {
      const mcpConfigPath = path.join(app.getPath('userData'), 'mcp-config.json')
      fs.writeFileSync(mcpConfigPath, JSON.stringify({
        mcpServers: {
          devcontrol: {
            type: 'http',
            url: `http://127.0.0.1:${mcpPortNum}/mcp`,
          }
        }
      }, null, 2))
      mcpArgs.push('--mcp-config', mcpConfigPath)
      console.log(`[ai-agent] MCP config written to ${mcpConfigPath}`)
    } catch (err) {
      console.warn(`[ai-agent] Failed to write MCP config:`, err)
    }
  }

  // Sanitize null bytes — Node.js doesn't allow them in spawn arguments
  const sanitize = (s: string): string => s.replace(/\0/g, '')

  const args = [
    '--print',
    '--verbose',
    '--output-format', 'stream-json',
    '--dangerously-skip-permissions',
    '--system-prompt', sanitize(systemPrompt),
    '--settings', guardSettings,
    ...toolArgs,
    ...addDirArgs,
    ...mcpArgs,
    '--',
    sanitize(message),
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
      ALLOWED_WRITE_DIR: taskDirPath || '',
      ALLOWED_READ_DIRS: [taskDirPath || '', ...readOnlyPaths].filter(Boolean).join(','),
    },
    stdio: ['pipe', 'pipe', 'pipe']
  })

  runningProcesses.set(taskId, child)
  updateTask(taskId, { activeProcessPid: child.pid, currentPhaseName: phaseConfig.name })
  sendNotification('phase_start', taskId, task.title, `${phaseConfig.name} phase started`)

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
  const stallTimeoutMs = ((phaseConfig.stallTimeout ?? settings.stallTimeoutMinutes ?? DEFAULT_STALL_TIMEOUT_MINUTES) * 60 * 1000)
  const stallCheckInterval = setInterval(() => {
    const elapsed = Date.now() - lastEventTime
    if (elapsed > stallTimeoutMs) {
      clearInterval(stallCheckInterval)
      const currentTask = getTaskById(taskId)
      if (!currentTask) return
      const retryCount = (currentTask.stallRetryCount || 0) + 1

      emit(taskId, `\n⚠️ Agent stalled (no events for ${Math.round(elapsed / 60000)}min)\n`)

      // Log stall in phase history
      const history = [...currentTask.phaseHistory]
      if (history.length > 0) {
        history[history.length - 1] = {
          ...history[history.length - 1],
          exitedAt: new Date().toISOString(),
          exitEvent: PhaseExitEvent.Stalled,
        }
      }

      // Kill the process
      const proc = runningProcesses.get(taskId)
      if (proc && proc.pid) {
        try { treeKill(proc.pid, 'SIGKILL') } catch { /* */ }
      }
      runningProcesses.delete(taskId)

      if (retryCount < MAX_STALL_RETRIES) {
        emit(taskId, `⚠️ Retrying phase (attempt ${retryCount + 1}/${MAX_STALL_RETRIES})...\n`)
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
          needsUserInputReason: AttentionReason.MaxRetries,
          stallRetryCount: retryCount,
          phaseHistory: history,
        })
        sendNotification('needs_attention', taskId, currentTask.title, 'Agent stalled repeatedly — needs attention')
      }
    }
  }, STALL_CHECK_INTERVAL_MS)

  const emitText = (text: string): void => {
    fullOutput += text
    appendTaskLog(taskId, text)
    emit(taskId, text)
  }

  const updateStatsFromEvent = (event: ClaudeStreamEvent): void => {
    // assistant events carry usage, model, and tool calls in content
    if (isAssistantEvent(event)) {
      const message = event.message

      if (message.model) stats.contextWindowMax = getContextWindowForModel(message.model)

      const usage = message.usage
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
      const content = message.content
      if (content) {
        for (const block of content) {
          if (isToolUseBlock(block)) {
            stats.toolCalls++
            if (!stats.toolNames.includes(block.name)) stats.toolNames.push(block.name)
          }
        }
      }

      stats.turns++
      emitStats(taskId)
    }

    // Final cost from result event
    if (isResultEvent(event)) {
      if (event.cost_usd !== undefined) {
        stats.costUsd = event.cost_usd
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
        const event: ClaudeStreamEvent = JSON.parse(line)
        lastEventTime = Date.now()
        if (isSaveableEvent(event)) {
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
        const event: ClaudeStreamEvent = JSON.parse(stdoutBuffer)
        if (isSaveableEvent(event)) {
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
      errHistory[errHistory.length - 1] = { ...errHistory[errHistory.length - 1], exitedAt: new Date().toISOString(), exitEvent: PhaseExitEvent.Error }
    }
    updateTask(taskId, { activeProcessPid: undefined, currentPhaseName: undefined, needsUserInput: true, needsUserInputReason: AttentionReason.Error, phaseHistory: errHistory })
    sendNotification('needs_attention', taskId, errTask?.title || taskId, `Agent error: ${err.message}`)
  })
}

function handleAgentCompletion(taskId: string, phaseConfig: AIPipelinePhase, output: string, exitCode: number | null): void {
  const task = getTaskById(taskId)
  if (!task) return

  if (exitCode !== 0 && exitCode !== null) {
    console.warn(`[ai-agent] Agent crashed for task ${taskId} (phase: ${phaseConfig.name}) with exit code ${exitCode}`)
    const history = [...task.phaseHistory]
    if (history.length > 0) {
      history[history.length - 1] = { ...history[history.length - 1], exitedAt: new Date().toISOString(), exitEvent: PhaseExitEvent.Crashed }
    }
    updateTask(taskId, {
      needsUserInput: true,
      needsUserInputReason: AttentionReason.Crashed,
      phaseHistory: history,
    })
    sendNotification('needs_attention', taskId, task.title, `Agent crashed in ${phaseConfig.name} (exit code ${exitCode})`)
    return
  }

  const pipeline = getBoardPipeline(task.boardId)
  const currentIndex = pipeline.findIndex(p => p.id === phaseConfig.id)

  // Reset stall retry count on successful completion
  updateTask(taskId, { stallRetryCount: 0 })

  // Check for reject pattern
  if (phaseConfig.rejectPattern && output.includes(phaseConfig.rejectPattern) && phaseConfig.rejectTarget) {
    const targetExists = pipeline.some(p => p.id === phaseConfig.rejectTarget)
    if (targetExists && phaseConfig.rejectTarget) {
      moveTaskPhase(taskId, phaseConfig.rejectTarget)
      enqueueTask(taskId)
      return
    }
  }

  // Move to next phase
  const nextIndex = currentIndex + 1
  if (nextIndex < pipeline.length) {
    moveTaskPhase(taskId, pipeline[nextIndex].id)
    if (pipeline[nextIndex].type === PhaseType.Agent) {
      enqueueTask(taskId)
    }
  } else {
    moveTaskPhase(taskId, FIXED_PHASES.DONE)
  }
}
