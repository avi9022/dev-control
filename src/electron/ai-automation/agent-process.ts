import { spawn, type ChildProcess } from 'child_process'
import { getTaskById, updateTask, getSettings } from './task-manager.js'
import { sendNotification } from './notification-manager.js'
import { getClaudePath } from './claude-path.js'
import { formatStreamEvent } from './stream-formatter.js'
import {
  type ClaudeStreamEvent,
  isAssistantEvent,
  isResultEvent,
  isToolUseBlock,
  isSaveableEvent,
} from './stream-types.js'
import {
  PhaseExitEvent,
  AttentionReason,
  DEFAULT_STALL_TIMEOUT_MINUTES,
  MAX_STALL_RETRIES,
} from '../../shared/constants.js'
import { type AgentSpawnConfig } from './agent-spawn-config.js'
import { type EventRecorder } from './context-history.js'

const DEFAULT_CONTEXT_WINDOW = 200_000
const STALL_CHECK_INTERVAL_MS = 30_000
const SECONDS_PER_MINUTE = 60
const MS_PER_SECOND = 1000
const MS_PER_MINUTE = SECONDS_PER_MINUTE * MS_PER_SECOND

const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'claude-opus-4': DEFAULT_CONTEXT_WINDOW,
  'claude-sonnet-4': DEFAULT_CONTEXT_WINDOW,
  'claude-haiku-4': DEFAULT_CONTEXT_WINDOW,
  'claude-3-5': DEFAULT_CONTEXT_WINDOW,
  'claude-3': DEFAULT_CONTEXT_WINDOW,
}

function getContextWindowForModel(model: string): number {
  for (const [prefix, size] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
    if (model.startsWith(prefix)) return size
  }
  return DEFAULT_CONTEXT_WINDOW
}

export interface AgentProcessCallbacks {
  onProcessStarted: (taskId: string, child: ChildProcess) => void
  onProcessEnded: (taskId: string) => void
  killProcess: (taskId: string) => void
  onOutput: (taskId: string, text: string) => void
  onStreamEvent: (taskId: string, event: ClaudeStreamEvent) => void
  onStatsUpdated: (taskId: string) => void
  appendLog: (taskId: string, text: string) => void
  enqueueTask: (taskId: string) => void
  onCompletion: (taskId: string, phaseConfig: AIPipelinePhase, output: string, exitCode: number | null) => void
}

export function initStats(taskId: string, statsMap: Map<string, AIAgentStats>): AIAgentStats {
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
  statsMap.set(taskId, stats)
  return stats
}

export function startAgentProcess(
  taskId: string,
  task: AITask,
  phaseConfig: AIPipelinePhase,
  finalArgs: string[],
  config: AgentSpawnConfig,
  eventRecorder: EventRecorder,
  header: string,
  statsMap: Map<string, AIAgentStats>,
  callbacks: AgentProcessCallbacks,
): void {
  const settings = getSettings()
  const claudePath = getClaudePath()
  console.log(`[ai-agent] Spawning ${claudePath} for task ${taskId} (phase: ${phaseConfig.name}), cwd: ${config.cwd}, worktrees: ${task.worktrees.length}`)

  const child = spawn(claudePath, finalArgs, {
    cwd: config.cwd,
    env: { ...process.env, ...config.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  callbacks.onProcessStarted(taskId, child)
  updateTask(taskId, { activeProcessPid: child.pid, currentPhaseName: phaseConfig.name })

  child.stdin?.end()

  let fullOutput = ''
  callbacks.appendLog(taskId, header)
  callbacks.onOutput(taskId, header)

  let stdoutBuffer = ''
  const stats = initStats(taskId, statsMap)

  let lastEventTime = Date.now()
  const stallTimeoutMs = (phaseConfig.stallTimeout ?? settings.stallTimeoutMinutes ?? DEFAULT_STALL_TIMEOUT_MINUTES) * MS_PER_MINUTE
  const stallCheckInterval = setInterval(() => {
    const elapsed = Date.now() - lastEventTime
    if (elapsed > stallTimeoutMs) {
      clearInterval(stallCheckInterval)
      handleStallDetected(taskId, elapsed, callbacks)
    }
  }, STALL_CHECK_INTERVAL_MS)

  const emitText = (text: string): void => {
    fullOutput += text
    callbacks.appendLog(taskId, text)
    callbacks.onOutput(taskId, text)
  }

  const updateStatsFromEvent = (event: ClaudeStreamEvent): void => {
    if (isAssistantEvent(event)) {
      const msg = event.message
      if (msg.model) stats.contextWindowMax = getContextWindowForModel(msg.model)

      const usage = msg.usage
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

      const content = msg.content
      if (content) {
        for (const block of content) {
          if (isToolUseBlock(block)) {
            stats.toolCalls++
            if (!stats.toolNames.includes(block.name)) stats.toolNames.push(block.name)
          }
        }
      }

      stats.turns++
      callbacks.onStatsUpdated(taskId)
    }

    if (isResultEvent(event)) {
      if (event.cost_usd !== undefined) stats.costUsd = event.cost_usd
      callbacks.onStatsUpdated(taskId)
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
        if (isSaveableEvent(event)) eventRecorder.append(event)
        callbacks.onStreamEvent(taskId, event)
        updateStatsFromEvent(event)
        const formatted = formatStreamEvent(event)
        if (formatted) emitText(formatted)
      } catch {
        emitText(line + '\n')
      }
    }
  })

  child.stderr?.on('data', (data: Buffer) => {
    emitText(`[stderr] ${data.toString()}`)
  })

  child.on('exit', (code) => {
    clearInterval(stallCheckInterval)
    if (stdoutBuffer.trim()) {
      try {
        const event: ClaudeStreamEvent = JSON.parse(stdoutBuffer)
        if (isSaveableEvent(event)) eventRecorder.append(event)
        const formatted = formatStreamEvent(event)
        if (formatted) emitText(formatted)
      } catch {
        emitText(stdoutBuffer)
      }
    }
    eventRecorder.finalize()
    console.log(`[ai-agent] Agent exited for task ${taskId} (phase: ${phaseConfig.name}) with code ${code}`)
    callbacks.onProcessEnded(taskId)
    updateTask(taskId, { activeProcessPid: undefined, currentPhaseName: undefined })
    callbacks.onCompletion(taskId, phaseConfig, fullOutput, code)
  })

  child.on('error', (err) => {
    clearInterval(stallCheckInterval)
    const errorMsg = `Failed to spawn claude for task ${taskId}: ${err.message}`
    console.error(`[ai-agent] ${errorMsg}`)
    const errorText = `\n[ERROR] ${errorMsg}\n`
    callbacks.appendLog(taskId, errorText)
    callbacks.onOutput(taskId, errorText)
    callbacks.onProcessEnded(taskId)
    const errTask = getTaskById(taskId)
    const errHistory = errTask ? [...errTask.phaseHistory] : []
    if (errHistory.length > 0) {
      errHistory[errHistory.length - 1] = { ...errHistory[errHistory.length - 1], exitedAt: new Date().toISOString(), exitEvent: PhaseExitEvent.Error }
    }
    updateTask(taskId, { activeProcessPid: undefined, currentPhaseName: undefined, needsUserInput: true, needsUserInputReason: AttentionReason.Error, phaseHistory: errHistory })
    sendNotification('needs_attention', taskId, errTask?.title || taskId, `Agent error: ${err.message}`)
  })
}

function handleStallDetected(taskId: string, elapsedMs: number, callbacks: AgentProcessCallbacks): void {
  const currentTask = getTaskById(taskId)
  if (!currentTask) return
  const retryCount = (currentTask.stallRetryCount || 0) + 1

  callbacks.onOutput(taskId, `\n⚠️ Agent stalled (no events for ${Math.round(elapsedMs / MS_PER_MINUTE)}min)\n`)

  const history = [...currentTask.phaseHistory]
  if (history.length > 0) {
    history[history.length - 1] = {
      ...history[history.length - 1],
      exitedAt: new Date().toISOString(),
      exitEvent: PhaseExitEvent.Stalled,
    }
  }

  callbacks.killProcess(taskId)
  callbacks.onProcessEnded(taskId)

  if (retryCount < MAX_STALL_RETRIES) {
    callbacks.onOutput(taskId, `⚠️ Retrying phase (attempt ${retryCount + 1}/${MAX_STALL_RETRIES})...\n`)
    updateTask(taskId, {
      activeProcessPid: undefined,
      currentPhaseName: undefined,
      stallRetryCount: retryCount,
      phaseHistory: history,
    })
    callbacks.enqueueTask(taskId)
  } else {
    callbacks.onOutput(taskId, `⚠️ Max retries reached — needs attention\n`)
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
