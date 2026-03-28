import { useState, type FC } from 'react'
import { ToolLayout, InputArea, OutputArea } from './shared'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export const JsonFormatter: FC = () => {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [indent, setIndent] = useState('2')

  const handleFormat = () => {
    try {
      setError('')
      const parsed = JSON.parse(input)
      const spaces = indent === 'tab' ? '\t' : parseInt(indent, 10)
      setOutput(JSON.stringify(parsed, null, spaces))
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error'
      setError(`Invalid JSON: ${errorMessage}`)
      setOutput('')
    }
  }

  const handleMinify = () => {
    try {
      setError('')
      const parsed = JSON.parse(input)
      setOutput(JSON.stringify(parsed))
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error'
      setError(`Invalid JSON: ${errorMessage}`)
      setOutput('')
    }
  }

  const handleValidate = () => {
    try {
      JSON.parse(input)
      setError('')
      setOutput('Valid JSON!')
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error'
      setError(`Invalid JSON: ${errorMessage}`)
      setOutput('')
    }
  }

  return (
    <ToolLayout
      title="JSON Formatter"
      description="Format, minify, and validate JSON"
    >
      <div className="space-y-4">
        <InputArea
          value={input}
          onChange={setInput}
          label="JSON Input"
          placeholder='{"key": "value", "array": [1, 2, 3]}'
          rows={10}
        />

        <div className="flex gap-2 items-center">
          <Button onClick={handleFormat} className="flex-1">
            Format
          </Button>
          <Button onClick={handleMinify} variant="outline" className="flex-1">
            Minify
          </Button>
          <Button onClick={handleValidate} variant="outline" className="flex-1">
            Validate
          </Button>
          <Select value={indent} onValueChange={setIndent}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 spaces</SelectItem>
              <SelectItem value="4">4 spaces</SelectItem>
              <SelectItem value="tab">Tab</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <OutputArea value={output} label="Result" error={error} />
      </div>
    </ToolLayout>
  )
}
