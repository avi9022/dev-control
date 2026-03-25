import { getProjectKnowledge } from '../project-knowledge-manager.js'
import { type McpToolDefinition, textResult, errorResult } from './types.js'

export const getProjectKnowledgeTool: McpToolDefinition<{ projectPath: string }> = {
  name: 'get_project_knowledge',
  description:
    'Get detailed knowledge about a specific project including architecture, key files, APIs, data flow, and development setup. Use this when you need deeper understanding of a project beyond the profile summary.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: { type: 'string', description: 'Full path to the project directory' },
    },
    required: ['projectPath'],
  },
  async handler(args) {
    const { projectPath } = args
    if (!projectPath) return errorResult('projectPath is required')

    const knowledge = getProjectKnowledge(projectPath)

    if (!knowledge) {
      return errorResult(
        'No knowledge document found for this project. Ask the user to generate project knowledge from the settings.',
      )
    }

    return textResult(knowledge)
  },
}
