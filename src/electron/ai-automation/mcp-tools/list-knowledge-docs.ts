import { getSettings } from '../task-manager.js'
import { type McpToolDefinition, textResult } from './types.js'

export const listKnowledgeDocsTool: McpToolDefinition = {
  name: 'list_knowledge_docs',
  description: 'List all available knowledge documents. Returns their IDs, titles, and brief descriptions.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  async handler() {
    const settings = getSettings()
    const docs = settings.knowledgeDocs || []

    if (docs.length === 0) {
      return textResult('No knowledge documents available.')
    }

    const list = docs.map(doc => `- [${doc.id}] ${doc.title}${doc.sourcePath ? ` (source: ${doc.sourcePath})` : ''}`).join('\n')
    return textResult(`Available knowledge documents:\n${list}`)
  },
}
