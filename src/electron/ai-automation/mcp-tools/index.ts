import { type McpToolBase } from './types.js'
import { resolveCommentTool } from './resolve-comment.js'
import { listCommentsTool } from './list-comments.js'
import { createTaskTool } from './create-task.js'
import { createBoardTool } from './create-board.js'
import { listKnowledgeDocsTool } from './list-knowledge-docs.js'
import { readKnowledgeDocTool } from './read-knowledge-doc.js'
import { listProjectsTool } from './list-projects.js'
import { listBoardsTool } from './list-boards.js'
import { requestProjectCreationTool } from './request-project-creation.js'
import { createTasksTool } from './create-tasks.js'
import { getProjectKnowledgeTool } from './get-project-knowledge.js'

// Register all MCP tools here — add new tools to this array.
// McpToolBase uses Record<string, unknown> for the handler arg, which is the
// actual runtime type from the MCP SDK. Each tool narrows internally.
export const mcpTools: McpToolBase[] = [
  resolveCommentTool as McpToolBase,
  listCommentsTool as McpToolBase,
  createTaskTool as McpToolBase,
  createBoardTool as McpToolBase,
  listKnowledgeDocsTool as McpToolBase,
  readKnowledgeDocTool as McpToolBase,
  listProjectsTool as McpToolBase,
  listBoardsTool as McpToolBase,
  requestProjectCreationTool as McpToolBase,
  createTasksTool as McpToolBase,
  getProjectKnowledgeTool as McpToolBase,
]
