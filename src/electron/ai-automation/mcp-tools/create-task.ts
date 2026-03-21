import { createTask } from '../task-manager.js'
import { type McpToolDefinition, textResult, errorResult } from './types.js'

export const createTaskTool: McpToolDefinition = {
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
    const title = args.title as string
    const description = args.description as string
    const boardId = args.boardId as string | undefined
    const projectPaths = args.projectPaths as string | undefined

    if (!title || !description) {
      return errorResult('title and description are required')
    }

    const projects = projectPaths
      ? projectPaths.split(',').map(p => p.trim()).filter(Boolean).map(path => ({
          path,
          label: path.split('/').pop() || path,
          gitStrategy: 'worktree' as const,
        }))
      : []

    try {
      const task = createTask(title, description, projects, boardId)
      return textResult(`Task created successfully. ID: ${task.id}, Title: ${task.title}`)
    } catch (err) {
      return errorResult(`Failed to create task: ${err}`)
    }
  },
}
