#!/usr/bin/env node
// Quick test script for the DevControl MCP server
// Usage: node scripts/test-mcp.mjs <port> [taskId]

import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'

const port = process.argv[2]
const taskId = process.argv[3]

if (!port) {
  console.error('Usage: node scripts/test-mcp.mjs <port> [taskId]')
  process.exit(1)
}

const url = `http://127.0.0.1:${port}/mcp`
console.log(`Connecting to ${url}...`)

const transport = new StreamableHTTPClientTransport(new URL(url))
const client = new Client({ name: 'test-client', version: '1.0.0' })

await client.connect(transport)
console.log('Connected!\n')

// List tools
const tools = await client.listTools()
console.log('Available tools:')
for (const tool of tools.tools) {
  console.log(`  - ${tool.name}: ${tool.description}`)
}
console.log()

// If taskId provided, test list_comments
if (taskId) {
  console.log(`Listing comments for task ${taskId}...`)
  const result = await client.callTool({ name: 'list_comments', arguments: { taskId } })
  console.log('Result:', JSON.stringify(result, null, 2))
}

await client.close()
console.log('\nDone!')
