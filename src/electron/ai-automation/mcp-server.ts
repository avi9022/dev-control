import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import http from 'http'
import { randomUUID } from 'crypto'
import { mcpTools } from './mcp-tools/index.js'
import { errorResult } from './mcp-tools/types.js'

const MCP_SERVER_NAME = 'devcontrol'
const MCP_SERVER_VERSION = '1.0.0'
const MCP_ENDPOINT = '/mcp'
const LISTEN_HOST = '127.0.0.1'

let httpServer: http.Server | null = null
let mcpPort: number | null = null

export function getMcpPort(): number | null {
  return mcpPort
}

interface CallToolParams {
  name: string
  arguments?: Record<string, unknown>
}

/**
 * Register tool handlers on the MCP server.
 * The CallToolRequestSchema handler is wrapped in a function to avoid the
 * MCP SDK's deep type instantiation issue (TS2589) when calling
 * `setRequestHandler(CallToolRequestSchema, ...)` directly with an inline
 * handler. By assigning the handler to a typed variable first we bypass the
 * type-depth limit.
 */
function registerToolHandlers(mcpServer: McpServer): void {
  mcpServer.server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: mcpTools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }))

  const callToolHandler = async (request: { params: CallToolParams }) => {
    const { name, arguments: args } = request.params
    const tool = mcpTools.find(t => t.name === name)
    if (!tool) {
      return errorResult(`Unknown tool: ${name}`)
    }
    return tool.handler(args || {})
  }

  // @ts-expect-error — The MCP SDK's CallToolRequestSchema triggers TS2589
  // ("type instantiation is excessively deep and possibly infinite") due to
  // recursive Zod type inference in the SDK's type definitions. This is a known
  // SDK limitation and cannot be resolved without patching the SDK itself.
  // The handler signature is correct at runtime.
  mcpServer.server.setRequestHandler(CallToolRequestSchema, callToolHandler)
}

function createMcpServer(): McpServer {
  const mcpServer = new McpServer(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    { capabilities: { tools: {} } }
  )

  registerToolHandlers(mcpServer)
  return mcpServer
}

export async function startMcpServer(): Promise<number> {
  // Store active transports by session ID
  const transports = new Map<string, StreamableHTTPServerTransport>()

  httpServer = http.createServer(async (req, res) => {
    if (!req.url?.startsWith(MCP_ENDPOINT)) {
      res.writeHead(404)
      res.end('Not found')
      return
    }

    try {
      // Check for existing session
      const sessionHeader = req.headers['mcp-session-id']
      const sessionId = typeof sessionHeader === 'string' ? sessionHeader : undefined

      if (sessionId && transports.has(sessionId)) {
        // Reuse existing transport for this session
        const transport = transports.get(sessionId)
        if (transport) {
          await transport.handleRequest(req, res)
          return
        }
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
    if (!httpServer) {
      reject(new Error('HTTP server not created'))
      return
    }

    const server = httpServer
    server.listen(0, LISTEN_HOST, () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') {
        mcpPort = addr.port
        console.log(`[mcp-server] DevControl MCP server running on http://${LISTEN_HOST}:${mcpPort}${MCP_ENDPOINT}`)
        resolve(mcpPort)
      } else {
        reject(new Error('Failed to get server address'))
      }
    })
    server.on('error', reject)
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
