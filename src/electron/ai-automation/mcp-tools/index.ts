import { type McpToolDefinition } from './types.js'
import { resolveCommentTool } from './resolve-comment.js'
import { listCommentsTool } from './list-comments.js'
import { createTaskTool } from './create-task.js'
import { createBoardTool } from './create-board.js'

// Register all MCP tools here — add new tools to this array
export const mcpTools: McpToolDefinition[] = [
  resolveCommentTool,
  listCommentsTool,
  createTaskTool,
  createBoardTool,
]
