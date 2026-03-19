import { getTaskById } from '../task-manager.js'
import { type McpToolDefinition, textResult } from './types.js'

export const listCommentsTool: McpToolDefinition = {
  name: 'list_comments',
  description: 'List all unresolved human review comments for a task',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'The task ID' },
    },
    required: ['taskId'],
  },
  async handler(args) {
    const taskId = args.taskId as string
    if (!taskId) {
      return textResult('Error: taskId is required')
    }
    const task = getTaskById(taskId)
    if (!task) {
      return textResult(`Error: Task ${taskId} not found`)
    }
    const comments = (task.humanComments || []).filter(c => !c.resolved)
    if (comments.length === 0) {
      return textResult('No unresolved comments')
    }
    const list = comments.map(c => ({
      id: c.id,
      file: c.file || '(general)',
      line: c.line,
      comment: c.comment,
    }))
    return textResult(JSON.stringify(list, null, 2))
  },
}
