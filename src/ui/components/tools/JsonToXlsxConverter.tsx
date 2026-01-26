import { useState, useRef, type FC } from 'react'
import { ToolLayout } from './shared'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import * as XLSX from 'xlsx'

const LARGE_FILE_THRESHOLD = 100 * 1024 // 100KB

interface FileInfo {
  name: string
  size: number
  rowCount?: number
}

export const JsonToXlsxConverter: FC = () => {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [filename, setFilename] = useState('data')
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [parsedData, setParsedData] = useState<unknown[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isLargeFile = fileInfo && fileInfo.size > LARGE_FILE_THRESHOLD

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Set filename from uploaded file (without extension)
    const nameWithoutExt = file.name.replace(/\.json$/i, '')
    setFilename(nameWithoutExt)

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setError('')

      // Try to parse immediately to get row count
      try {
        const parsed = JSON.parse(content)
        const data = Array.isArray(parsed) ? parsed : [parsed]
        setParsedData(data)

        setFileInfo({
          name: file.name,
          size: file.size,
          rowCount: data.length,
        })

        // Only show in textarea if small enough
        if (file.size <= LARGE_FILE_THRESHOLD) {
          setInput(content)
        } else {
          setInput('')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid JSON file')
        setFileInfo(null)
        setParsedData(null)
      }
    }
    reader.onerror = () => {
      setError('Failed to read file')
    }
    reader.readAsText(file)

    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const handleInputChange = (value: string) => {
    setInput(value)
    setFileInfo(null)
    setParsedData(null)
  }

  const clearFile = () => {
    setInput('')
    setFileInfo(null)
    setParsedData(null)
    setFilename('data')
    setError('')
  }

  const handleConvert = () => {
    try {
      setError('')

      // Use pre-parsed data if available, otherwise parse input
      let data: unknown[]
      if (parsedData) {
        data = parsedData
      } else {
        const parsed = JSON.parse(input)
        data = Array.isArray(parsed) ? parsed : [parsed]
      }

      if (data.length === 0) {
        setError('JSON array is empty')
        return
      }

      // Create worksheet from JSON data
      const worksheet = XLSX.utils.json_to_sheet(data)

      // Create workbook and add worksheet
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')

      // Generate and download file
      XLSX.writeFile(workbook, `${filename || 'data'}.xlsx`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Conversion failed')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <ToolLayout
      title="JSON to XLSX Converter"
      description="Convert JSON data to Excel spreadsheet"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">JSON Input</label>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileSelect}
                className="hidden"
              />
              {(fileInfo || input) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFile}
                >
                  Clear
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Select File
              </Button>
            </div>
          </div>

          {isLargeFile ? (
            <div className="h-[300px] border rounded-md bg-muted/50 flex items-center justify-center">
              <div className="text-center space-y-2">
                <p className="text-sm font-medium">{fileInfo.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(fileInfo.size)} • {fileInfo.rowCount?.toLocaleString()} rows
                </p>
                <p className="text-xs text-muted-foreground">
                  Large file loaded - ready to convert
                </p>
              </div>
            </div>
          ) : (
            <Textarea
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={'[\n  {"name": "John", "age": 30, "city": "NYC"},\n  {"name": "Jane", "age": 25, "city": "LA"}\n]'}
              className="font-mono text-sm resize-none h-[300px]"
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground whitespace-nowrap">
            Filename:
          </label>
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border rounded-md bg-background"
            placeholder="data"
          />
          <span className="text-sm text-muted-foreground">.xlsx</span>
        </div>

        <Button onClick={handleConvert} className="w-full">
          Download XLSX
        </Button>

        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>Supports:</p>
          <ul className="list-disc list-inside ml-2">
            <li>Array of objects (each object becomes a row)</li>
            <li>Single object (becomes one row)</li>
            <li>Nested values are stringified</li>
          </ul>
        </div>
      </div>
    </ToolLayout>
  )
}
