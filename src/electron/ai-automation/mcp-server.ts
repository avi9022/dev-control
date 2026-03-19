import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import http from 'http'
import { randomUUID } from 'crypto'
import { mcpTools } from './mcp-tools/index.js'
import { errorResult } from './mcp-tools/types.js'

let httpServer: http.Server | null = null
let mcpPort: number | null = null

export function getMcpPort(): number | null {
  return mcpPort
}

function createMcpServer(): McpServer {
  const mcpServer = new McpServer(
    { name: 'devcontrol', version: '1.0.0' },
    { capabilities: { tools: {} } }
  )

  mcpServer.server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: mcpTools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }))

  // @ts-expect-error — MCP SDK type instantiation too deep for CallToolRequestSchema
  mcpServer.server.setRequestHandler(CallToolRequestSchema, async (request: { params: { name: string; arguments?: Record<string, unknown> } }) => {
    const { name, arguments: args } = request.params
    const tool = mcpTools.find(t => t.name === name)
    if (!tool) {
      return errorResult(`Unknown tool: ${name}`)
    }
    return tool.handler(args || {})
  })

  return mcpServer
}

export async function startMcpServer(): Promise<number> {
  // Store active transports by session ID
  const transports = new Map<string, StreamableHTTPServerTransport>()

  httpServer = http.createServer(async (req, res) => {
    if (req.url !== '/mcp' && !req.url?.startsWith('/mcp')) {
      res.writeHead(404)
      res.end('Not found')
      return
    }

    try {
      // Check for existing session
      const sessionId = req.headers['mcp-session-id'] as string | undefined

      if (sessionId && transports.has(sessionId)) {
        // Reuse existing transport for this session
        const transport = transports.get(sessionId)!
        await transport.handleRequest(req, res)
        return
      }

      // New session — create new transport and server
      if (req.method === 'POST') {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            transports.set(id, transport)
          },
          onsessionclosed: (id) => {
            transports.delete(id)
          },
        })

        const mcpServer = createMcpServer()
        await mcpServer.connect(transport)
        await transport.handleRequest(req, res)
      } else if (req.method === 'DELETE') {
        // Session cleanup for unknown session
        res.writeHead(404)
        res.end('Session not found')
      } else {
        res.writeHead(405)
        res.end('Method not allowed')
      }
    } catch (err) {
      console.error('[mcp-server] Request error:', err)
      if (!res.headersSent) {
        res.writeHead(500)
        res.end(JSON.stringify({ error: String(err) }))
      }
    }
  })

  return new Promise((resolve, reject) => {
    httpServer!.listen(0, '127.0.0.1', () => {
      const addr = httpServer!.address()
      if (addr && typeof addr === 'object') {
        mcpPort = addr.port
        console.log(`[mcp-server] DevControl MCP server running on http://127.0.0.1:${mcpPort}/mcp`)
        resolve(mcpPort)
      } else {
        reject(new Error('Failed to get server address'))
      }
    })
    httpServer!.on('error', reject)
  })
}

export function stopMcpServer(): void {
  if (httpServer) {
    httpServer.close()
    httpServer = null
    mcpPort = null
    console.log('[mcp-server] DevControl MCP server stopped')
  }
}
