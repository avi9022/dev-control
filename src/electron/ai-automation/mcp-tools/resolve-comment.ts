import { getTaskById, updateTask } from '../task-manager.js'
import { type McpToolDefinition, textResult, errorResult } from './types.js'
import { RESOLVER } from '../../../shared/constants.js'

export const resolveCommentTool: McpToolDefinition<{ taskId: string; commentId: string }> = {
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
    const { taskId, commentId } = args
    if (!taskId || !commentId) {
      return errorResult('taskId and commentId are required')
    }
    const task = getTaskById(taskId)
    if (!task) {
      return errorResult(`Task ${taskId} not found`)
    }
    const comments = task.humanComments || []
    const comment = comments.find(c => c.id === commentId)
    if (!comment) {
      return errorResult(`Comment ${commentId} not found`)
    }
    if (comment.resolvedBy?.includes(RESOLVER.AGENT)) {
      return textResult('Comment already resolved by agent')
    }
    const updated = comments.map(c =>
      c.id === commentId ? { ...c, resolvedBy: [...(c.resolvedBy || []), RESOLVER.AGENT] } : c
    )
    updateTask(taskId, { humanComments: updated })
    return textResult('Comment resolved successfully')
  },
}
