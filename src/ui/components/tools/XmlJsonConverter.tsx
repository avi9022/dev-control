import { useState, type FC } from 'react'
import { ToolLayout, InputArea, OutputArea } from './shared'
import { Button } from '@/components/ui/button'

function xmlToJson(xml: string): unknown {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error('Invalid XML: ' + parseError.textContent)
  }

  function nodeToJson(node: Element): unknown {
    const result: Record<string, unknown> = {}

    for (const attr of Array.from(node.attributes)) {
      result[`@${attr.name}`] = attr.value
    }

    const children = Array.from(node.children)
    if (children.length === 0) {
      const text = node.textContent?.trim()
      if (Object.keys(result).length === 0) {
        return text || null
      }
      if (text) {
        result['#text'] = text
      }
      return result
    }

    const childMap: Record<string, unknown[]> = {}
    for (const child of children) {
      const name = child.tagName
      if (!childMap[name]) childMap[name] = []
      childMap[name].push(nodeToJson(child))
    }

    for (const [name, values] of Object.entries(childMap)) {
      result[name] = values.length === 1 ? values[0] : values
    }

    return result
  }

  const root = doc.documentElement
  return { [root.tagName]: nodeToJson(root) }
}

function jsonToXml(json: unknown, indent = 0): string {
  const spaces = '  '.repeat(indent)

  if (json === null || json === undefined) {
    return ''
  }

  if (typeof json !== 'object') {
    return String(json)
  }

  if (Array.isArray(json)) {
    return json.map((item) => jsonToXml(item, indent)).join('\n')
  }

  const obj = json as Record<string, unknown>
  const lines: string[] = []

  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('@')) continue
    if (key === '#text') continue

    const attrs = Object.entries(obj)
      .filter(([k]) => k.startsWith('@'))
      .map(([k, v]) => `${k.slice(1)}="${v}"`)
      .join(' ')

    const attrStr = attrs ? ` ${attrs}` : ''

    if (Array.isArray(value)) {
      for (const item of value) {
        const content = jsonToXml(item, indent + 1)
        if (typeof item === 'object' && item !== null) {
          lines.push(`${spaces}<${key}${attrStr}>`)
          lines.push(content)
          lines.push(`${spaces}</${key}>`)
        } else {
          lines.push(`${spaces}<${key}${attrStr}>${content}</${key}>`)
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      lines.push(`${spaces}<${key}${attrStr}>`)
      lines.push(jsonToXml(value, indent + 1))
      lines.push(`${spaces}</${key}>`)
    } else {
      lines.push(`${spaces}<${key}${attrStr}>${value ?? ''}</${key}>`)
    }
  }

  return lines.join('\n')
}

export const XmlJsonConverter: FC = () => {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'xml-to-json' | 'json-to-xml'>('xml-to-json')

  const handleConvert = () => {
    try {
      setError('')
      if (mode === 'xml-to-json') {
        const result = xmlToJson(input)
        setOutput(JSON.stringify(result, null, 2))
      } else {
        const parsed = JSON.parse(input)
        const result = jsonToXml(parsed)
        setOutput('<?xml version="1.0" encoding="UTF-8"?>\n' + result)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Conversion failed')
      setOutput('')
    }
  }

  const handleModeChange = (newMode: 'xml-to-json' | 'json-to-xml') => {
    setMode(newMode)
    setOutput('')
    setError('')
  }

  return (
    <ToolLayout
      title="XML ↔ JSON Converter"
      description="Convert between XML and JSON formats"
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant={mode === 'xml-to-json' ? 'default' : 'outline'}
            onClick={() => handleModeChange('xml-to-json')}
          >
            XML → JSON
          </Button>
          <Button
            variant={mode === 'json-to-xml' ? 'default' : 'outline'}
            onClick={() => handleModeChange('json-to-xml')}
          >
            JSON → XML
          </Button>
        </div>

        <InputArea
          value={input}
          onChange={setInput}
          label={mode === 'xml-to-json' ? 'XML Input' : 'JSON Input'}
          placeholder={mode === 'xml-to-json' ? '<root><item>value</item></root>' : '{"root": {"item": "value"}}'}
          rows={8}
        />

        <Button onClick={handleConvert} className="w-full">
          Convert
        </Button>

        <OutputArea
          value={output}
          label={mode === 'xml-to-json' ? 'JSON Output' : 'XML Output'}
          error={error}
        />
      </div>
    </ToolLayout>
  )
}
