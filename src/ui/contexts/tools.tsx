import { createContext, useContext, useState, useEffect, type FC, type PropsWithChildren } from 'react'

export type ToolCategory =
  | 'encoding'
  | 'formatting'
  | 'generators'
  | 'time'
  | 'text'
  | 'network'

export interface Tool {
  id: string
  name: string
  description: string
  icon: string
  category: ToolCategory
}

export const TOOLS: Tool[] = [
  // Encoding/Decoding
  { id: 'jwt-decoder', name: 'JWT Decoder', description: 'Decode JWT tokens, view header/payload/signature', icon: 'KeyRound', category: 'encoding' },
  { id: 'base64', name: 'Base64', description: 'Encode/decode Base64 strings', icon: 'Binary', category: 'encoding' },
  { id: 'url-encoder', name: 'URL Encoder', description: 'Encode/decode URL components', icon: 'Link', category: 'encoding' },
  { id: 'html-entity', name: 'HTML Entity', description: 'Escape/unescape HTML entities', icon: 'Code', category: 'encoding' },

  // Data Formatting
  { id: 'json-formatter', name: 'JSON Formatter', description: 'Pretty print, minify, validate JSON', icon: 'Braces', category: 'formatting' },
  { id: 'json-diff', name: 'JSON Diff', description: 'Compare two JSON objects', icon: 'GitCompare', category: 'formatting' },
  { id: 'xml-json', name: 'XML ↔ JSON', description: 'Convert between XML and JSON', icon: 'FileJson', category: 'formatting' },
  { id: 'yaml-json', name: 'YAML ↔ JSON', description: 'Convert between YAML and JSON', icon: 'FileCode', category: 'formatting' },
  { id: 'json-xlsx', name: 'JSON to XLSX', description: 'Convert JSON data to Excel spreadsheet', icon: 'FileSpreadsheet', category: 'formatting' },

  // Generators
  { id: 'uuid-generator', name: 'UUID Generator', description: 'Generate UUID v4/v7, bulk generation', icon: 'Fingerprint', category: 'generators' },
  { id: 'hash-generator', name: 'Hash Generator', description: 'Generate MD5, SHA-1, SHA-256, SHA-512 hashes', icon: 'Hash', category: 'generators' },
  { id: 'password-generator', name: 'Password Generator', description: 'Customizable secure password generation', icon: 'Lock', category: 'generators' },
  { id: 'lorem-ipsum', name: 'Lorem Ipsum', description: 'Generate placeholder text', icon: 'Text', category: 'generators' },

  // Time & Date
  { id: 'unix-timestamp', name: 'Unix Timestamp', description: 'Convert timestamps to human-readable dates', icon: 'Clock', category: 'time' },
  { id: 'timezone-converter', name: 'Timezone Converter', description: 'Convert times between timezones', icon: 'Globe', category: 'time' },

  // Text Utilities
  { id: 'regex-tester', name: 'Regex Tester', description: 'Test regex patterns with live matching', icon: 'Regex', category: 'text' },
  { id: 'string-case', name: 'Case Converter', description: 'camelCase, snake_case, kebab-case, etc.', icon: 'CaseSensitive', category: 'text' },
  { id: 'text-diff', name: 'Text Diff', description: 'Compare two text blocks', icon: 'FileDiff', category: 'text' },
  { id: 'text-stats', name: 'Text Stats', description: 'Count chars, words, lines', icon: 'BarChart2', category: 'text' },

  // Network/API
  { id: 'http-status', name: 'HTTP Status Codes', description: 'Reference guide with descriptions', icon: 'Server', category: 'network' },
  { id: 'curl-to-code', name: 'cURL to Code', description: 'Convert cURL commands to code', icon: 'Terminal', category: 'network' },
]

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  encoding: 'Encoding/Decoding',
  formatting: 'Data Formatting',
  generators: 'Generators',
  time: 'Time & Date',
  text: 'Text Utilities',
  network: 'Network/API',
}

const RECENT_TOOLS_KEY = 'dev-center-recent-tools'
const MAX_RECENT_TOOLS = 5

interface ToolsContextValue {
  tools: Tool[]
  recentTools: string[]
  addRecentTool: (toolId: string) => void
  getToolById: (id: string) => Tool | undefined
  getToolsByCategory: (category: ToolCategory) => Tool[]
  searchTools: (query: string) => Tool[]
}

export const ToolsContext = createContext<ToolsContextValue>({
  tools: TOOLS,
  recentTools: [],
  addRecentTool: () => {},
  getToolById: () => undefined,
  getToolsByCategory: () => [],
  searchTools: () => [],
})

export function useTools() {
  return useContext(ToolsContext)
}

export const ToolsProvider: FC<PropsWithChildren> = ({ children }) => {
  const [recentTools, setRecentTools] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(RECENT_TOOLS_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(RECENT_TOOLS_KEY, JSON.stringify(recentTools))
  }, [recentTools])

  const addRecentTool = (toolId: string) => {
    setRecentTools((prev) => {
      const filtered = prev.filter((id) => id !== toolId)
      return [toolId, ...filtered].slice(0, MAX_RECENT_TOOLS)
    })
  }

  const getToolById = (id: string) => TOOLS.find((tool) => tool.id === id)

  const getToolsByCategory = (category: ToolCategory) =>
    TOOLS.filter((tool) => tool.category === category)

  const searchTools = (query: string) => {
    const lowerQuery = query.toLowerCase()
    return TOOLS.filter(
      (tool) =>
        tool.name.toLowerCase().includes(lowerQuery) ||
        tool.description.toLowerCase().includes(lowerQuery)
    )
  }

  return (
    <ToolsContext.Provider
      value={{
        tools: TOOLS,
        recentTools,
        addRecentTool,
        getToolById,
        getToolsByCategory,
        searchTools,
      }}
    >
      {children}
    </ToolsContext.Provider>
  )
}
