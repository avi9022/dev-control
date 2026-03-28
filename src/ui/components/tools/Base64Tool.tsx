import { useState, type FC } from 'react'
import { ToolLayout, InputArea, OutputArea } from './shared'
import { Button } from '@/components/ui/button'

export const Base64Tool: FC = () => {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')

  const handleEncode = () => {
    try {
      setError('')
      const encoded = btoa(unescape(encodeURIComponent(input)))
      setOutput(encoded)
    } catch (e) {
      setError(`Encoding failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
      setOutput('')
    }
  }

  const handleDecode = () => {
    try {
      setError('')
      const decoded = decodeURIComponent(escape(atob(input)))
      setOutput(decoded)
    } catch (e) {
      setError(`Decoding failed: ${e instanceof Error ? e.message : 'Invalid Base64 string'}`)
      setOutput('')
    }
  }

  const handleModeChange = (newMode: 'encode' | 'decode') => {
    setMode(newMode)
    setOutput('')
    setError('')
  }

  return (
    <ToolLayout
      title="Base64 Encoder/Decoder"
      description="Encode text to Base64 or decode Base64 to text"
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant={mode === 'encode' ? 'default' : 'outline'}
            onClick={() => handleModeChange('encode')}
          >
            Encode
          </Button>
          <Button
            variant={mode === 'decode' ? 'default' : 'outline'}
            onClick={() => handleModeChange('decode')}
          >
            Decode
          </Button>
        </div>

        <InputArea
          value={input}
          onChange={setInput}
          label={mode === 'encode' ? 'Text to encode' : 'Base64 to decode'}
          placeholder={mode === 'encode' ? 'Enter text to encode...' : 'Enter Base64 string to decode...'}
        />

        <Button onClick={mode === 'encode' ? handleEncode : handleDecode} className="w-full">
          {mode === 'encode' ? 'Encode to Base64' : 'Decode from Base64'}
        </Button>

        <OutputArea value={output} label="Result" error={error} />
      </div>
    </ToolLayout>
  )
}
