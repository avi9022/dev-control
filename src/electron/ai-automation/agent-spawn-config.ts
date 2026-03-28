import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { getMcpPort } from './mcp-server.js'
import { getGuardScriptPath } from './guard-script.js'
import { GIT_STRATEGY } from '../../shared/constants.js'

const JSON_INDENT = 2
const ADDITIONAL_WORKTREES_START_INDEX = 1

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

const AGENT_ROLE_VALUES = new Set<string>(Object.values(AgentRole))

function isAgentRole(value: string): value is AgentRole {
  return AGENT_ROLE_VALUES.has(value)
}

export interface AgentSpawnConfig {
  cliArgs: string[]
  cwd: string
  env: Record<string, string>
  taskDirPath: string
}

export function sanitizeArg(s: string): string {
  return s.replace(/\0/g, '')
}

export function resolveWorkingDirectory(task: AITask): string {
  if (task.worktrees.length > 0) return task.worktrees[0].worktreePath
  if (task.projects.length > 0) return task.projects[0].path
  return process.cwd()
}

export function buildAllowedTools(phaseConfig: AIPipelinePhase): string[] {
  if (phaseConfig.allowedTools && (!phaseConfig.roles || phaseConfig.roles.length === 0) && !phaseConfig.customTools) {
    return phaseConfig.allowedTools.split(',').map(t => t.trim()).filter(Boolean)
  }

  const tools = new Set<string>()

  if (phaseConfig.roles) {
    for (const role of phaseConfig.roles) {
      if (isAgentRole(role)) {
        const roleTools = ROLE_TOOLS[role]
        for (const tool of roleTools) tools.add(tool)
      }
    }
  }

  if (phaseConfig.customTools) {
    const custom = phaseConfig.customTools.split(/[,\s]+/).filter(Boolean)
    for (const tool of custom) tools.add(tool)
  }

  return [...tools]
}

export function buildAgentArgs(task: AITask, phaseConfig: AIPipelinePhase, systemPrompt: string): AgentSpawnConfig {
  const taskDirPath = task.taskDirPath || ''

  const allowedTools = buildAllowedTools(phaseConfig)
  const toolArgs: string[] = []
  if (allowedTools.length > 0) {
    toolArgs.push('--allowedTools', allowedTools.join(','))
  }

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

  const addDirArgs: string[] = []
  if (taskDirPath) {
    addDirArgs.push('--add-dir', taskDirPath)
  }
  for (const wt of task.worktrees.slice(ADDITIONAL_WORKTREES_START_INDEX)) {
    addDirArgs.push('--add-dir', wt.worktreePath)
  }
  const readOnlyPaths: string[] = []
  for (const project of task.projects) {
    if (project.gitStrategy === GIT_STRATEGY.NONE) {
      addDirArgs.push('--add-dir', project.path)
      readOnlyPaths.push(project.path)
    }
  }

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
      }, null, JSON_INDENT))
      mcpArgs.push('--mcp-config', mcpConfigPath)
    } catch (err) {
      console.warn(`[ai-agent] Failed to write MCP config:`, err)
    }
  }

  const cliArgs = [
    '--print',
    '--verbose',
    '--output-format', 'stream-json',
    '--dangerously-skip-permissions',
    '--system-prompt', sanitizeArg(systemPrompt),
    '--settings', guardSettings,
    ...toolArgs,
    ...addDirArgs,
    ...mcpArgs,
  ]

  return {
    cliArgs,
    cwd: resolveWorkingDirectory(task),
    env: {
      ALLOWED_WRITE_DIR: taskDirPath,
      ALLOWED_READ_DIRS: [taskDirPath, ...readOnlyPaths].filter(Boolean).join(','),
    },
    taskDirPath,
  }
}
