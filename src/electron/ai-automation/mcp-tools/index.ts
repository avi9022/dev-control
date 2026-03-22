import { type McpToolDefinition } from './types.js'
import { resolveCommentTool } from './resolve-comment.js'
import { listCommentsTool } from './list-comments.js'
import { createTaskTool } from './create-task.js'
import { createBoardTool } from './create-board.js'
import { listKnowledgeDocsTool } from './list-knowledge-docs.js'
import { readKnowledgeDocTool } from './read-knowledge-doc.js'
import { listProjectsTool } from './list-projects.js'
import { listBoardsTool } from './list-boards.js'

// Register all MCP tools here — add new tools to this array
export const mcpTools: McpToolDefinition[] = [
  resolveCommentTool,
  listCommentsTool,
  createTaskTool,
  createBoardTool,
  listKnowledgeDocsTool,
  readKnowledgeDocTool,
  listProjectsTool,
  listBoardsTool,
]
