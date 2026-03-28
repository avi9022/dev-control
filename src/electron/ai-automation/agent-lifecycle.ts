import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { type ChildProcess } from 'child_process'
import { getTaskById, updateTask, moveTaskPhase, getSettings, getBoardPipeline } from './task-manager.js'
import { sendNotification } from './notification-manager.js'
import { buildPrompt } from './prompt-builder.js'
import { createWorktree, generateBranchName } from './worktree-manager.js'
import { getOrCreateTaskDir } from './task-dir-manager.js'
import { type ClaudeStreamEvent } from './stream-types.js'
import {
  FIXED_PHASES,
  PhaseExitEvent,
  AttentionReason,
  PhaseType,
  GIT_STRATEGY,
} from '../../shared/constants.js'
import { sanitizeArg, buildAgentArgs } from './agent-spawn-config.js'
import { createEventRecorder, ensureContextHistoryDir } from './context-history.js'
import { startAgentProcess, type AgentProcessCallbacks } from './agent-process.js'

const RESUME_CONTINUATION_MESSAGE = 'Continue where you left off. You were previously interrupted — pick up from where you stopped.'

interface AgentLifecycleDeps {
  runningProcesses: Map<string, ChildProcess>
  pendingUserMessages: Map<string, string>
  agentStats: Map<string, AIAgentStats>
  emit: (taskId: string, text: string) => void
  emitStreamEvent: (taskId: string, event: ClaudeStreamEvent) => void
  emitStats: (taskId: string) => void
  appendLog: (taskId: string, text: string) => void
  enqueueTask: (taskId: string) => void
  killProcess: (taskId: string) => void
}

let deps: AgentLifecycleDeps

export function initLifecycle(d: AgentLifecycleDeps): void {
  deps = d
}

function getProcessCallbacks(): AgentProcessCallbacks {
  return {
    onProcessStarted(taskId: string, child: ChildProcess): void {
      deps.runningProcesses.set(taskId, child)
    },
    onProcessEnded(taskId: string): void {
      deps.runningProcesses.delete(taskId)
    },
    killProcess: deps.killProcess,
    onOutput: deps.emit,
    onStreamEvent: deps.emitStreamEvent,
    onStatsUpdated: deps.emitStats,
    appendLog: deps.appendLog,
    enqueueTask: deps.enqueueTask,
    onCompletion: handleAgentCompletion,
  }
}

export function spawnAgent(taskId: string, phaseConfig: AIPipelinePhase): void {
  let task = getTaskById(taskId)
  if (!task) return

  if (task.sessionId && task.phase === phaseConfig.id) {
    resumeAgent(taskId, RESUME_CONTINUATION_MESSAGE)
    return
  }

  const settings = getSettings()

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
        deps.emit(taskId, `\n📁 Created worktree: ${worktreePath} (branch: ${branchName} from ${baseBranch || 'auto'})\n`)
      } catch (err) {
        deps.emit(taskId, `\n⚠️ Git setup failed for ${project.label}: ${err instanceof Error ? err.message : String(err)}. Agent will use project directory.\n`)
      }
    }
    if (newWorktrees.length > 0) {
      updateTask(taskId, { worktrees: [...task.worktrees, ...newWorktrees] })
      const refreshedTask = getTaskById(taskId)
      if (!refreshedTask) return
      task = refreshedTask
    }
  }

  if (!task.taskDirPath) {
    const taskDir = getOrCreateTaskDir(taskId)
    updateTask(taskId, { taskDirPath: taskDir })
    const refreshedTask = getTaskById(taskId)
    if (!refreshedTask) return
    task = refreshedTask
  }

  const systemPrompt = buildPrompt(task, phaseConfig)
  const sessionId = randomUUID()
  updateTask(taskId, { sessionId })

  const taskDirPath = task.taskDirPath
  if (!taskDirPath) return
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const contextHistoryDir = path.join(taskDirPath, 'context-history', `${phaseConfig.id}-${timestamp}`)
  fs.mkdirSync(contextHistoryDir, { recursive: true })
  fs.writeFileSync(path.join(contextHistoryDir, 'prompt.md'), systemPrompt)
  fs.writeFileSync(path.join(contextHistoryDir, 'events.json'), '[\n')

  const phaseHistory = [...task.phaseHistory]
  if (phaseHistory.length > 0) {
    const lastEntry = phaseHistory[phaseHistory.length - 1]
    if (lastEntry.phase === phaseConfig.id && !lastEntry.exitedAt) {
      phaseHistory[phaseHistory.length - 1] = { ...lastEntry, contextHistoryPath: contextHistoryDir, sessionId }
      updateTask(taskId, { phaseHistory })
      const refreshedTask = getTaskById(taskId)
      if (!refreshedTask) return
      task = refreshedTask
    }
  }

  let message = task.description
  if (task.humanComments && task.humanComments.length > 0) {
    message += '\n\nHuman review comments to address:\n' + task.humanComments.map(c => `- ${c.file}:${c.line}: ${c.comment}`).join('\n')
  }

  const config = buildAgentArgs(task, phaseConfig, systemPrompt)
  const eventRecorder = createEventRecorder(contextHistoryDir)

  const finalArgs = [
    ...config.cliArgs,
    '--session-id', sessionId,
    '--',
    sanitizeArg(message),
  ]

  sendNotification('phase_start', taskId, task.title, `${phaseConfig.name} phase started`)
  const header = `\n--- ${phaseConfig.name.toUpperCase()} AGENT ---\n`
  startAgentProcess(taskId, task, phaseConfig, finalArgs, config, eventRecorder, header, deps.agentStats, getProcessCallbacks())
}

export function resumeAgent(taskId: string, userMessage: string): void {
  let task = getTaskById(taskId)
  if (!task) return
  if (!task.sessionId) return
  const sessionId = task.sessionId

  const pipeline = getBoardPipeline(task.boardId)
  const currentPhaseId = task.phase
  const phaseConfig = pipeline.find(p => p.id === currentPhaseId)
  if (!phaseConfig) return

  const lastEntry = task.phaseHistory[task.phaseHistory.length - 1]
  const needsNewEntry = !lastEntry || lastEntry.exitedAt !== undefined

  if (needsNewEntry) {
    const now = new Date().toISOString()
    const phaseHistory = [...task.phaseHistory]
    phaseHistory.push({ phase: currentPhaseId, enteredAt: now, sessionId })
    updateTask(taskId, { phaseHistory })
    task = getTaskById(taskId) || task
  }

  const contextHistoryDir = ensureContextHistoryDir(task, taskId, phaseConfig)
  task = getTaskById(taskId) || task

  const systemPrompt = buildPrompt(task, phaseConfig)
  const config = buildAgentArgs(task, phaseConfig, systemPrompt)

  const eventRecorder = contextHistoryDir
    ? createEventRecorder(contextHistoryDir)
    : { append(): void { }, finalize(): void { } }

  const isSystemMessage = userMessage === RESUME_CONTINUATION_MESSAGE
  if (!isSystemMessage) {
    const userEvent: ClaudeStreamEvent = {
      type: 'user',
      message: { content: [{ type: 'text', text: userMessage }] },
      isHumanMessage: true,
    }
    eventRecorder.append(userEvent)
    deps.emitStreamEvent(taskId, userEvent)
  }

  const wrappedMessage = isSystemMessage ? userMessage : [
    'IMPORTANT — The user has interrupted you with a new message.',
    'Stop what you were doing and address this message first:\n',
    userMessage,
  ].join('\n')

  const finalArgs = [
    ...config.cliArgs,
    '--resume', sessionId,
    '--',
    sanitizeArg(wrappedMessage),
  ]

  const header = isSystemMessage
    ? `\n--- RESUMED ---\n`
    : `\n--- RESUMED (user message) ---\n`
  startAgentProcess(taskId, task, phaseConfig, finalArgs, config, eventRecorder, header, deps.agentStats, getProcessCallbacks())
}

function handleAgentCompletion(taskId: string, phaseConfig: AIPipelinePhase, output: string, exitCode: number | null): void {
  const pendingMessage = deps.pendingUserMessages.get(taskId)
  if (pendingMessage !== undefined) {
    deps.pendingUserMessages.delete(taskId)
    resumeAgent(taskId, pendingMessage)
    return
  }

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

  updateTask(taskId, { stallRetryCount: 0 })

  if (phaseConfig.rejectPattern && output.includes(phaseConfig.rejectPattern) && phaseConfig.rejectTarget) {
    const targetExists = pipeline.some(p => p.id === phaseConfig.rejectTarget)
    if (targetExists && phaseConfig.rejectTarget) {
      moveTaskPhase(taskId, phaseConfig.rejectTarget)
      deps.enqueueTask(taskId)
      return
    }
  }

  const nextIndex = currentIndex + 1
  if (nextIndex < pipeline.length) {
    moveTaskPhase(taskId, pipeline[nextIndex].id)
    if (pipeline[nextIndex].type === PhaseType.Agent) {
      deps.enqueueTask(taskId)
    }
  } else {
    moveTaskPhase(taskId, FIXED_PHASES.DONE)
  }

  deps.enqueueTask(taskId)
}
