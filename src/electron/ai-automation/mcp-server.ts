import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import http from 'http'
import { getTaskById, updateTask } from './task-manager.js'
import { z } from 'zod'

let server: http.Server | null = null
let mcpPort: number | null = null

export function getMcpPort(): number | null {
  return mcpPort
}

export async function startMcpServer(): Promise<number> {
  const mcpServer = new McpServer({
    name: 'devcontrol',
    version: '1.0.0',
  })

  // Tool: resolve_comment
  mcpServer.tool(
    'resolve_comment',
    'Mark a human review comment as resolved by the agent',
    {
      taskId: z.string().describe('The task ID'),
      commentId: z.string().describe('The comment ID to resolve'),
    },
    async ({ taskId, commentId }) => {
      const task = getTaskById(taskId)
      if (!task) {
        return { content: [{ type: 'text' as const, text: `Error: Task ${taskId} not found` }] }
      }
      const comments = task.humanComments || []
      const comment = comments.find(c => c.id === commentId)
      if (!comment) {
        return { content: [{ type: 'text' as const, text: `Error: Comment ${commentId} not found` }] }
      }
      if (comment.resolved) {
        return { content: [{ type: 'text' as const, text: `Comment already resolved` }] }
      }
      const updated = comments.map(c =>
        c.id === commentId ? { ...c, resolved: true, resolvedBy: 'agent' as const } : c
      )
      updateTask(taskId, { humanComments: updated })
      return { content: [{ type: 'text' as const, text: `Comment resolved successfully` }] }
    }
  )

  // Tool: list_comments
  mcpServer.tool(
    'list_comments',
    'List all unresolved human review comments for a task',
    {
      taskId: z.string().describe('The task ID'),
    },
    async ({ taskId }) => {
      const task = getTaskById(taskId)
      if (!task) {
        return { content: [{ type: 'text' as const, text: `Error: Task ${taskId} not found` }] }
      }
      const comments = (task.humanComments || []).filter(c => !c.resolved)
      if (comments.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No unresolved comments' }] }
      }
      const list = comments.map(c => ({
        id: c.id,
        file: c.file || '(general)',
        line: c.line,
        comment: c.comment,
      }))
      return { content: [{ type: 'text' as const, text: JSON.stringify(list, null, 2) }] }
    }
  )

  // Create HTTP server with Streamable HTTP transport
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })

  server = http.createServer(async (req, res) => {
    if (req.url === '/mcp' || req.url?.startsWith('/mcp')) {
      await transport.handleRequest(req, res)
    } else {
      res.writeHead(404)
      res.end('Not found')
    }
  })

  await mcpServer.connect(transport)

  return new Promise((resolve, reject) => {
    server!.listen(0, '127.0.0.1', () => {
      const addr = server!.address()
      if (addr && typeof addr === 'object') {
        mcpPort = addr.port
        console.log(`[mcp-server] DevControl MCP server running on http://127.0.0.1:${mcpPort}/mcp`)
        resolve(mcpPort)
      } else {
        reject(new Error('Failed to get server address'))
      }
    })
    server!.on('error', reject)
  })
}

export function stopMcpServer(): void {
  if (server) {
    server.close()
    server = null
    mcpPort = null
    console.log('[mcp-server] DevControl MCP server stopped')
  }
}
