import { getSettings } from '../task-manager.js'
import { type McpToolDefinition, textResult, errorResult } from './types.js'
import { readFileSync } from 'fs'

export const readKnowledgeDocTool: McpToolDefinition = {
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
    const docId = args.docId as string
    if (!docId) return errorResult('docId is required')

    const settings = getSettings()
    const docs = settings.knowledgeDocs || []
    const doc = docs.find(d => d.id === docId)

    if (!doc) return errorResult(`Knowledge doc "${docId}" not found`)

    try {
      const content = readFileSync(doc.filePath, 'utf-8')
      return textResult(`# ${doc.title}\n\n${content}`)
    } catch {
      return errorResult(`Failed to read knowledge doc at ${doc.filePath}`)
    }
  },
}
