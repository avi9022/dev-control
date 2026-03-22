import { getSettings } from '../task-manager.js'
import { type McpToolDefinition, textResult } from './types.js'

export const listBoardsTool: McpToolDefinition = {
  name: 'list_boards',
  description: 'List all kanban boards with their IDs, names, and pipeline phases.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  async handler() {
    const settings = getSettings()
    const boards = settings.boards || []

    if (boards.length === 0) {
      return textResult('No boards exist yet.')
    }

    const list = boards.map(board => {
      const phases = board.pipeline.map(p => p.name).join(' → ')
      return `- [${board.id}] **${board.name}** (${board.pipeline.length} phases: ${phases})`
    }).join('\n')

    return textResult(`Existing boards:\n${list}\n\nActive board: ${settings.activeBoardId}`)
  },
}
