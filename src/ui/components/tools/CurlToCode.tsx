import { useState, useMemo, type FC } from 'react'
import { ToolLayout, InputArea, OutputArea } from './shared'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type OutputFormat = 'fetch' | 'axios' | 'node-fetch'

interface ParsedCurl {
  method: string
  url: string
  headers: Record<string, string>
  data?: string
  error?: string
}

function parseCurl(curl: string): ParsedCurl {
  const result: ParsedCurl = {
    method: 'GET',
    url: '',
    headers: {},
  }

  if (!curl.trim()) {
    return result
  }

  const normalized = curl.replace(/\\\n/g, ' ').replace(/\s+/g, ' ').trim()

  if (!normalized.toLowerCase().startsWith('curl ')) {
    return { ...result, error: 'Command must start with "curl"' }
  }

  const urlMatch = normalized.match(/curl\s+(?:.*?\s+)?['"]?(https?:\/\/[^\s'"]+)['"]?/i)
    || normalized.match(/curl\s+(?:.*?\s+)?(['"])(https?:\/\/[^'"]+)\1/i)

  if (urlMatch) {
    result.url = urlMatch[2] || urlMatch[1]
  }

  const methodMatch = normalized.match(/-X\s+['"]?(\w+)['"]?/i)
  if (methodMatch) {
    result.method = methodMatch[1].toUpperCase()
  }

  const headerMatches = normalized.matchAll(/-H\s+['"]([^'"]+)['"]/gi)
  for (const headerMatch of headerMatches) {
    const [key, ...valueParts] = headerMatch[1].split(':')
    if (key && valueParts.length > 0) {
      result.headers[key.trim()] = valueParts.join(':').trim()
    }
  }

  const dataMatch = normalized.match(/(?:-d|--data|--data-raw)\s+['"](.+?)['"]/i)
    || normalized.match(/(?:-d|--data|--data-raw)\s+(\S+)/i)
  if (dataMatch) {
    result.data = dataMatch[1]
    if (result.method === 'GET') {
      result.method = 'POST'
    }
  }

  if (!result.url) {
    const simpleUrlMatch = normalized.match(/curl\s+['"]?(https?:\/\/\S+)['"]?/i)
    if (simpleUrlMatch) {
      result.url = simpleUrlMatch[1].replace(/['"]$/, '')
    }
  }

  if (!result.url) {
    return { ...result, error: 'Could not parse URL from curl command' }
  }

  return result
}

function toFetch(parsed: ParsedCurl): string {
  const options: string[] = []

  if (parsed.method !== 'GET') {
    options.push(`  method: '${parsed.method}'`)
  }

  if (Object.keys(parsed.headers).length > 0) {
    const headerLines = Object.entries(parsed.headers)
      .map(([k, v]) => `    '${k}': '${v}'`)
      .join(',\n')
    options.push(`  headers: {\n${headerLines}\n  }`)
  }

  if (parsed.data) {
    const isJson = parsed.headers['Content-Type']?.includes('application/json')
    if (isJson) {
      try {
        JSON.parse(parsed.data)
        options.push(`  body: JSON.stringify(${parsed.data})`)
      } catch {
        options.push(`  body: '${parsed.data.replace(/'/g, "\\'")}'`)
      }
    } else {
      options.push(`  body: '${parsed.data.replace(/'/g, "\\'")}'`)
    }
  }

  if (options.length === 0) {
    return `fetch('${parsed.url}')`
  }

  return `fetch('${parsed.url}', {\n${options.join(',\n')}\n})`
}

function toAxios(parsed: ParsedCurl): string {
  const config: string[] = []

  config.push(`  url: '${parsed.url}'`)
  config.push(`  method: '${parsed.method.toLowerCase()}'`)

  if (Object.keys(parsed.headers).length > 0) {
    const headerLines = Object.entries(parsed.headers)
      .map(([k, v]) => `    '${k}': '${v}'`)
      .join(',\n')
    config.push(`  headers: {\n${headerLines}\n  }`)
  }

  if (parsed.data) {
    const isJson = parsed.headers['Content-Type']?.includes('application/json')
    if (isJson) {
      try {
        JSON.parse(parsed.data)
        config.push(`  data: ${parsed.data}`)
      } catch {
        config.push(`  data: '${parsed.data.replace(/'/g, "\\'")}'`)
      }
    } else {
      config.push(`  data: '${parsed.data.replace(/'/g, "\\'")}'`)
    }
  }

  return `axios({\n${config.join(',\n')}\n})`
}

function toNodeFetch(parsed: ParsedCurl): string {
  const lines: string[] = []
  lines.push("import fetch from 'node-fetch';")
  lines.push('')

  const options: string[] = []

  if (parsed.method !== 'GET') {
    options.push(`  method: '${parsed.method}'`)
  }

  if (Object.keys(parsed.headers).length > 0) {
    const headerLines = Object.entries(parsed.headers)
      .map(([k, v]) => `    '${k}': '${v}'`)
      .join(',\n')
    options.push(`  headers: {\n${headerLines}\n  }`)
  }

  if (parsed.data) {
    options.push(`  body: '${parsed.data.replace(/'/g, "\\'")}'`)
  }

  if (options.length === 0) {
    lines.push(`const response = await fetch('${parsed.url}');`)
  } else {
    lines.push(`const response = await fetch('${parsed.url}', {`)
    lines.push(options.join(',\n'))
    lines.push('});')
  }

  lines.push('const data = await response.json();')

  return lines.join('\n')
}

const CONVERTERS: Record<OutputFormat, (parsed: ParsedCurl) => string> = {
  fetch: toFetch,
  axios: toAxios,
  'node-fetch': toNodeFetch,
}

export const CurlToCode: FC = () => {
  const [input, setInput] = useState('')
  const [format, setFormat] = useState<OutputFormat>('fetch')

  const result = useMemo(() => {
    const parsed = parseCurl(input)
    if (parsed.error) {
      return { code: '', error: parsed.error }
    }
    if (!parsed.url) {
      return { code: '', error: '' }
    }
    return { code: CONVERTERS[format](parsed), error: '' }
  }, [input, format])

  return (
    <ToolLayout
      title="cURL to Code"
      description="Convert cURL commands to JavaScript code"
    >
      <div className="space-y-4">
        <InputArea
          value={input}
          onChange={setInput}
          label="cURL Command"
          placeholder={`curl -X POST 'https://api.example.com/data' \\
  -H 'Content-Type: application/json' \\
  -d '{"key": "value"}'`}
          rows={6}
        />

        <div className="flex items-center gap-2">
          <span className="text-sm">Output format:</span>
          <Select value={format} onValueChange={(v) => setFormat(v as OutputFormat)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fetch">Fetch API</SelectItem>
              <SelectItem value="axios">Axios</SelectItem>
              <SelectItem value="node-fetch">Node Fetch</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <OutputArea value={result.code} label="Generated Code" error={result.error} />

        <div className="text-xs text-muted-foreground space-y-1">
          <p>Supported cURL options: -X (method), -H (headers), -d/--data (body)</p>
          <p>Multi-line commands with backslash continuation are supported.</p>
        </div>
      </div>
    </ToolLayout>
  )
}
