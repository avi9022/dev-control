export interface McpToolResult {
  content: { type: 'text'; text: string }[]
  isError?: boolean
}

export interface McpToolDefinition<T extends Record<string, string | undefined> = Record<string, string | undefined>> {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required: string[]
  }
  handler: (args: T) => Promise<McpToolResult>
}

/**
 * Non-generic base type for storing heterogeneous McpToolDefinition instances
 * in a single array. The handler accepts `Record<string, unknown>` because
 * MCP args arrive untyped at runtime — each tool validates internally.
 */
export interface McpToolBase {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required: string[]
  }
  handler: (args: Record<string, unknown>) => Promise<McpToolResult>
}

export function textResult(text: string): McpToolResult {
  return { content: [{ type: 'text', text }] }
}

export function errorResult(text: string): McpToolResult {
  return { content: [{ type: 'text', text }], isError: true }
}
