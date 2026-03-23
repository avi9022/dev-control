import { store } from '../../storage/store.js'
import { type McpToolDefinition, textResult } from './types.js'
import { WORKTREE_ID_PREFIX } from '../../../shared/constants.js'

export const listProjectsTool: McpToolDefinition = {
  name: 'list_projects',
  description: 'List all projects registered in DevControl with their paths, run commands, and ports.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  async handler() {
    const directories = store.get('directories')

    if (!directories || directories.length === 0) {
      return textResult('No projects registered.')
    }

    const list = directories
      .filter(d => !d.id.startsWith(WORKTREE_ID_PREFIX))
      .map(d => {
        const parts = [`- **${d.name}**`]
        parts.push(`  Path: ${d.path}`)
        if (d.runCommand) parts.push(`  Run: ${d.runCommand}`)
        if (d.port) parts.push(`  Port: ${d.port}`)
        if (d.isFrontendProj) parts.push(`  Type: Frontend`)
        return parts.join('\n')
      })
      .join('\n')

    return textResult(`Registered projects:\n${list}`)
  },
}
