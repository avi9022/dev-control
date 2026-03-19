import { getTaskById, updateTask } from '../task-manager.js'
import { type McpToolDefinition, textResult } from './types.js'

export const resolveCommentTool: McpToolDefinition = {
  name: 'resolve_comment',
  description: 'Mark a human review comment as resolved by the agent. Use the comment ID from the prompt.',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'The task ID' },
      commentId: { type: 'string', description: 'The comment ID to resolve' },
    },
    required: ['taskId', 'commentId'],
  },
  async handler(args) {
    const taskId = args.taskId as string
    const commentId = args.commentId as string
    if (!taskId || !commentId) {
      return textResult('Error: taskId and commentId are required')
    }
    const task = getTaskById(taskId)
    if (!task) {
      return textResult(`Error: Task ${taskId} not found`)
    }
    const comments = task.humanComments || []
    const comment = comments.find(c => c.id === commentId)
    if (!comment) {
      return textResult(`Error: Comment ${commentId} not found`)
    }
    if (comment.resolvedBy?.includes('agent')) {
      return textResult('Comment already resolved by agent')
    }
    const updated = comments.map(c =>
      c.id === commentId ? { ...c, resolvedBy: [...(c.resolvedBy || []), 'agent' as const] } : c
    )
    updateTask(taskId, { humanComments: updated })
    return textResult('Comment resolved successfully')
  },
}
