import { useState, type FC } from 'react'
import { ToolLayout, InputArea, OutputArea } from './shared'
import { Button } from '@/components/ui/button'

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
}

const REVERSE_ENTITIES: Record<string, string> = Object.fromEntries(
  Object.entries(HTML_ENTITIES).map(([k, v]) => [v, k])
)

function encodeHtmlEntities(str: string): string {
  return str.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char)
}

function decodeHtmlEntities(str: string): string {
  let result = str

  for (const [entity, char] of Object.entries(REVERSE_ENTITIES)) {
    result = result.split(entity).join(char)
  }

  result = result.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))

  return result
}

export const HtmlEntityTool: FC = () => {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')

  const handleEncode = () => {
    setOutput(encodeHtmlEntities(input))
  }

  const handleDecode = () => {
    setOutput(decodeHtmlEntities(input))
  }

  const handleModeChange = (newMode: 'encode' | 'decode') => {
    setMode(newMode)
    setOutput('')
  }

  return (
    <ToolLayout
      title="HTML Entity Encoder/Decoder"
      description="Escape or unescape HTML entities"
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant={mode === 'encode' ? 'default' : 'outline'}
            onClick={() => handleModeChange('encode')}
          >
            Encode (Escape)
          </Button>
          <Button
            variant={mode === 'decode' ? 'default' : 'outline'}
            onClick={() => handleModeChange('decode')}
          >
            Decode (Unescape)
          </Button>
        </div>

        <InputArea
          value={input}
          onChange={setInput}
          label={mode === 'encode' ? 'HTML to escape' : 'Escaped HTML to decode'}
          placeholder={mode === 'encode' ? 'Enter HTML with special characters...' : 'Enter escaped HTML entities...'}
        />

        <Button onClick={mode === 'encode' ? handleEncode : handleDecode} className="w-full">
          {mode === 'encode' ? 'Encode HTML Entities' : 'Decode HTML Entities'}
        </Button>

        <OutputArea value={output} label="Result" />

        <div className="text-xs text-muted-foreground">
          <p className="font-medium mb-1">Common HTML entities:</p>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(HTML_ENTITIES).slice(0, 8).map(([char, entity]) => (
              <div key={char} className="font-mono bg-muted/50 px-2 py-1 rounded">
                {char === ' ' ? '(space)' : char} → {entity}
              </div>
            ))}
          </div>
        </div>
      </div>
    </ToolLayout>
  )
}
