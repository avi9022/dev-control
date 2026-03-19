export interface McpToolResult {
  content: { type: 'text'; text: string }[]
  isError?: boolean
}

export interface McpToolDefinition {
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
