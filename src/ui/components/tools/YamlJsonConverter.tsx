import { useState, type FC } from 'react'
import { ToolLayout, InputArea, OutputArea } from './shared'
import { Button } from '@/components/ui/button'
import yaml from 'js-yaml'

export const YamlJsonConverter: FC = () => {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'yaml-to-json' | 'json-to-yaml'>('yaml-to-json')

  const handleConvert = () => {
    try {
      setError('')
      if (mode === 'yaml-to-json') {
        const parsed = yaml.load(input)
        setOutput(JSON.stringify(parsed, null, 2))
      } else {
        const parsed = JSON.parse(input)
        setOutput(yaml.dump(parsed, { indent: 2, lineWidth: -1 }))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Conversion failed')
      setOutput('')
    }
  }

  const handleModeChange = (newMode: 'yaml-to-json' | 'json-to-yaml') => {
    setMode(newMode)
    setOutput('')
    setError('')
  }

  return (
    <ToolLayout
      title="YAML ↔ JSON Converter"
      description="Convert between YAML and JSON formats"
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant={mode === 'yaml-to-json' ? 'default' : 'outline'}
            onClick={() => handleModeChange('yaml-to-json')}
          >
            YAML → JSON
          </Button>
          <Button
            variant={mode === 'json-to-yaml' ? 'default' : 'outline'}
            onClick={() => handleModeChange('json-to-yaml')}
          >
            JSON → YAML
          </Button>
        </div>

        <InputArea
          value={input}
          onChange={setInput}
          label={mode === 'yaml-to-json' ? 'YAML Input' : 'JSON Input'}
          placeholder={mode === 'yaml-to-json' ? 'key: value\nlist:\n  - item1\n  - item2' : '{"key": "value", "list": ["item1", "item2"]}'}
          rows={8}
        />

        <Button onClick={handleConvert} className="w-full">
          Convert
        </Button>

        <OutputArea
          value={output}
          label={mode === 'yaml-to-json' ? 'JSON Output' : 'YAML Output'}
          error={error}
        />
      </div>
    </ToolLayout>
  )
}
