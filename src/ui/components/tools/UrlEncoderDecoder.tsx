import { useState, type FC } from 'react'
import { ToolLayout, InputArea, OutputArea } from './shared'
import { Button } from '@/components/ui/button'

export const UrlEncoderDecoder: FC = () => {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')

  const handleEncode = () => {
    try {
      setError('')
      setOutput(encodeURIComponent(input))
    } catch (e) {
      setError(`Encoding failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
      setOutput('')
    }
  }

  const handleDecode = () => {
    try {
      setError('')
      setOutput(decodeURIComponent(input))
    } catch (e) {
      setError(`Decoding failed: ${e instanceof Error ? e.message : 'Invalid URL-encoded string'}`)
      setOutput('')
    }
  }

  const handleEncodeFullUrl = () => {
    try {
      setError('')
      setOutput(encodeURI(input))
    } catch (e) {
      setError(`Encoding failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
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
      title="URL Encoder/Decoder"
      description="Encode or decode URL components"
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
          label={mode === 'encode' ? 'Text to encode' : 'URL-encoded text to decode'}
          placeholder={mode === 'encode' ? 'Enter text or URL...' : 'Enter URL-encoded string...'}
        />

        {mode === 'encode' ? (
          <div className="flex gap-2">
            <Button onClick={handleEncode} className="flex-1">
              Encode Component
            </Button>
            <Button onClick={handleEncodeFullUrl} variant="outline" className="flex-1">
              Encode Full URL
            </Button>
          </div>
        ) : (
          <Button onClick={handleDecode} className="w-full">
            Decode
          </Button>
        )}

        <OutputArea value={output} label="Result" error={error} />
      </div>
    </ToolLayout>
  )
}
