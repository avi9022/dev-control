import { createTask } from '../task-manager.js'
import { type McpToolDefinition, textResult, errorResult } from './types.js'
import { GIT_STRATEGY } from '../../../shared/constants.js'

export const createTaskTool: McpToolDefinition<{ title: string; description: string; boardId?: string; projectPaths?: string }> = {
  name: 'create_task',
  description: 'Create a new task in the backlog. Optionally specify a board and project paths.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Task title' },
      description: { type: 'string', description: 'Task description — what needs to be done' },
      boardId: { type: 'string', description: 'Board ID to create the task on. If omitted, uses the active board.' },
      projectPaths: { type: 'string', description: 'Comma-separated project directory paths to associate with the task' },
    },
    required: ['title', 'description'],
  },
  async handler(args) {
    const { title, description, boardId, projectPaths } = args

    if (!title || !description) {
      return errorResult('title and description are required')
    }

    const projects = projectPaths
      ? projectPaths.split(',').map(p => p.trim()).filter(Boolean).map(path => ({
          path,
          label: path.split('/').pop() || path,
          gitStrategy: GIT_STRATEGY.WORKTREE,
        }))
      : []

    try {
      const task = createTask(title, description, projects, boardId)
      return textResult(`Task created successfully. ID: ${task.id}, Title: ${task.title}`)
    } catch (err) {
      return errorResult(`Failed to create task: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  },
}
