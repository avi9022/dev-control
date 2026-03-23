import { randomUUID } from 'crypto'
import { getSettings, updateSettings } from '../task-manager.js'
import { DEFAULT_PIPELINE } from '../../storage/store.js'
import { type McpToolDefinition, textResult, errorResult } from './types.js'
import { DEFAULT_BOARD_COLOR } from '../../../shared/constants.js'

export const createBoardTool: McpToolDefinition<{ name: string; color?: string }> = {
  name: 'create_board',
  description: 'Create a new kanban board with a default pipeline. Returns the new board ID.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Board name' },
      color: { type: 'string', description: 'Board color as hex string (e.g. #9BB89E). Optional.' },
    },
    required: ['name'],
  },
  async handler(args) {
    const { name } = args
    const color = args.color || DEFAULT_BOARD_COLOR

    if (!name) {
      return errorResult('name is required')
    }

    try {
      const settings = getSettings()
      const boards = settings.boards || []

      const newBoard = {
        id: randomUUID(),
        name,
        color,
        pipeline: DEFAULT_PIPELINE.map(p => ({ ...p })),
        createdAt: new Date().toISOString(),
      }

      updateSettings({
        boards: [...boards, newBoard],
        activeBoardId: newBoard.id,
      })

      return textResult(`Board created successfully. ID: ${newBoard.id}, Name: ${newBoard.name}`)
    } catch (err) {
      return errorResult(`Failed to create board: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  },
}
