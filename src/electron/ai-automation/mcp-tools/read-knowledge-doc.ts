import { getSettings } from '../task-manager.js'
import { type McpToolDefinition, textResult, errorResult } from './types.js'

export const readKnowledgeDocTool: McpToolDefinition<{ docId: string }> = {
  name: 'read_knowledge_doc',
  description: 'Read the full content of a knowledge document by its ID.',
  inputSchema: {
    type: 'object',
    properties: {
      docId: { type: 'string', description: 'The knowledge document ID' },
    },
    required: ['docId'],
  },
  async handler(args) {
    const { docId } = args
    if (!docId) return errorResult('docId is required')

    const settings = getSettings()
    const docs = settings.knowledgeDocs || []
    const doc = docs.find(d => d.id === docId)

    if (!doc) return errorResult(`Knowledge doc "${docId}" not found`)

    return textResult(`# ${doc.title}\n\n${doc.content}`)
  },
}
